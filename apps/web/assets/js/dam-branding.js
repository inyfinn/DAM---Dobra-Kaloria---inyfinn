(function () {
  "use strict";

  var index = null;
  var tokens = null;
  var campaigns = null;
  var CB = "bust20260720a";
  /** B3: lokalny poster gdy bridge/ffmpeg nie odda klatki (data-URI SVG). */
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
  var TAG_COUNTS_KEY = "dam_branding_show_tag_counts";
  var selectedCampaignId = null;
  var selectedChannel = "";
  var discoveryWhen = "";
  var datePresetActive = "";
  var associations = null;
  var RECENT_KEY = "dam_branding_recent";
  var campaignAssetMap = {};
  var currentGridAssets = [];
  var searchIndex = null;
  var productCorrelation = null;
  var activeTagFilters = {};
  /* Limit kart w siatce — sterowany z meta (suwak + OK); prefs.branding_page_size */
  var PAGE_SIZE_MIN = 24;
  var PAGE_SIZE_MAX = 500;
  var PAGE_SIZE_DEFAULT = 100;
  var PAGE_SIZE_SESSION_KEY = "dam_branding_page_size";
  var GRID_LIMIT_TAB = PAGE_SIZE_DEFAULT;
  var pageSizeDraft = PAGE_SIZE_DEFAULT;
  var CARD_ZOOM_KEY = "dam_viz_card_zoom";
  var CARD_ZOOM_MIN = 65;
  var CARD_ZOOM_MAX = 350;
  /* 1.0 (nie 1.2): skala >1 + overflow:visible karty wychodzila poza obrys (HARD 2026-07-21) */
  var CARD_IMG_BASE_SCALE = 1;
  var CARD_BASE_MIN_PX = 220;
  var facetCountCache = null;
  var brandingRenderRaf = 0;
  var CAT_HINT_DISMISS_KEY = "damBrandingCatHintDismissed";
  var catHintObserver = null;
  var catHintBound = false;

  var FACET_CHIPS = [
    { key: "media:image", label: "Obraz", group: "format_pliku" },
    { key: "media:vector", label: "Wektor", group: "format_pliku" },
    { key: "media:video", label: "Wideo", group: "format_pliku" },
    { key: "media:source", label: "Źródło", group: "format_pliku" },
    { key: "media:document", label: "Dokument", group: "format_pliku" },
    { key: "format:raster", label: "Raster", group: "cechy" },
    { key: "format:transparent", label: "Przezroczyste tło", group: "cechy" },
    { key: "format:white", label: "Tło białe", group: "cechy" },
    { key: "format:editable", label: "Edytowalny", group: "cechy" },
    { key: "appearance:desktop", label: "Desktop", group: "cechy", tab: "www" },
    { key: "appearance:tablet", label: "Tablet", group: "cechy", tab: "www" },
    { key: "appearance:mobile", label: "Mobile", group: "cechy", tab: "www" },
    { key: "perspective:FRONT", label: "FRONT", group: "wizualizacja" },
    { key: "perspective:ENFACE", label: "ENFACE", group: "wizualizacja" },
    { key: "perspective:BACK", label: "BACK", group: "wizualizacja" },
    { key: "perspective:TYL_ENFACE", label: "TYŁ-ENFACE", group: "wizualizacja" },
    { key: "size:XL", label: "XL", group: "wizualizacja" },
    { key: "size:L", label: "L", group: "wizualizacja" },
    { key: "size:S", label: "S", group: "wizualizacja" },
    { key: "size:S_SKLEP", label: "S-SKLEP", group: "wizualizacja" },
    { key: "channel:www", label: "WWW", group: "kanal" },
    { key: "channel:meta", label: "META", group: "kanal" },
    { key: "channel:instagram", label: "Instagram", group: "kanal" },
    { key: "channel:google", label: "Google", group: "kanal" },
    { key: "brand:DK", label: "DK", group: "marka" },
    { key: "brand:GC", label: "GC", group: "marka" },
    /* B4: Autor — appearance_tags / author field / path (Highlite) */
    { key: "author:Krzysztof", label: "Krzysztof", group: "autor" },
    { key: "author:Sylwia", label: "Sylwia", group: "autor" },
    { key: "author:Szymon", label: "Szymon", group: "autor" },
    { key: "author:Highlite", label: "Highlite", group: "autor" },
  ];

  var PRODUCT_TAG_CHIPS = [
    "Proteina",
    "Baton",
    "Karmel",
    "Banoffee",
    "Lemon cheesecake",
    "Indeks glikemiczny",
    "Deserowe",
    "Super cena",
    "Mini",
    "MCT",
    "Datesy",
    "Kulki",
    "Mix",
    "Bez cukru",
    "Doypack",
    "Boost",
    "Folia",
    "Sypkie",
    "Baner",
  ];

  /** Jeden klucz facet:* na cały panel — ten sam tag może być w wielu rzędach, ten sam filtr. */
  var CANONICAL_TAGS = [
    { id: "slider", label: "Slider", groups: ["skojarzenia", "przeznaczenie"], tab: "www" },
    { id: "na_sklep", label: "Na sklep", groups: ["przeznaczenie"], tab: "www" },
    { id: "baner", label: "Baner", groups: ["skojarzenia", "przeznaczenie"], tab: "www" },
    { id: "burger", label: "Burger", groups: ["skojarzenia", "co"] },
    { id: "grill", label: "Grill", groups: ["skojarzenia", "co"] },
    { id: "proteina", label: "Proteina", groups: ["skojarzenia", "co", "produkt"] },
    { id: "baton", label: "Baton", groups: ["skojarzenia", "co", "produkt"] },
    { id: "kulki", label: "Kulki", groups: ["skojarzenia", "co", "produkt"] },
    { id: "parowka", label: "Parówka", groups: ["skojarzenia", "co"] },
    { id: "niemiesa", label: "Niemięsa", groups: ["skojarzenia", "co"] },
    { id: "deserowe", label: "Deserowe", groups: ["co", "produkt"] },
    { id: "banoffee", label: "Banoffee", groups: ["skojarzenia", "co", "produkt"] },
    { id: "karmel", label: "Karmel", groups: ["skojarzenia", "co", "produkt"] },
    { id: "mix", label: "Mix", groups: ["skojarzenia", "co", "produkt"] },
    { id: "doypack", label: "Doypack", groups: ["skojarzenia", "co", "produkt"] },
    { id: "mini", label: "Mini", groups: ["co", "produkt"] },
    { id: "mct", label: "MCT", groups: ["co", "produkt"] },
    { id: "datesy", label: "Datesy", groups: ["co", "produkt"] },
    { id: "boost", label: "Boost", groups: ["co", "produkt"] },
    { id: "folia", label: "Folia", groups: ["co", "produkt"] },
    { id: "sypkie", label: "Sypkie", groups: ["co", "produkt"] },
    { id: "super_cena", label: "Super cena", groups: ["skojarzenia", "produkt"] },
    { id: "lemon_cheesecake", label: "Lemon cheesecake", groups: ["produkt"] },
    { id: "indeks_glikemiczny", label: "Indeks glikemiczny", groups: ["skojarzenia", "produkt"] },
    { id: "bez_cukru", label: "Bez cukru", groups: ["skojarzenia", "produkt"] },
  ];

  var CANONICAL_BY_ID = {};
  CANONICAL_TAGS.forEach(function (c) {
    CANONICAL_BY_ID[c.id] = c;
  });

  function facetKey(id) {
    return "facet:" + id;
  }

  function isCanonicalCovered(groupKey, labelOrTerm) {
    var n = normTag(labelOrTerm);
    if (!n) return false;
    return CANONICAL_TAGS.some(function (c) {
      if (c.groups.indexOf(groupKey) < 0) return false;
      var lid = normTag(c.label);
      var tid = normTag(String(c.id || "").replace(/_/g, " "));
      return n === lid || n === tid || lid.indexOf(n) !== -1 || n.indexOf(lid) !== -1;
    });
  }

  function canonicalChipsForGroup(groupKey) {
    return CANONICAL_TAGS.filter(function (c) {
      return c.groups.indexOf(groupKey) >= 0;
    }).map(function (c) {
      return { key: facetKey(c.id), label: c.label, group: groupKey, tab: c.tab || "" };
    });
  }

  function dedupeChipsByKey(chips) {
    var seen = {};
    var out = [];
    (chips || []).forEach(function (c) {
      if (!c || !c.key || seen[c.key]) return;
      seen[c.key] = true;
      out.push(c);
    });
    return out;
  }

  function assetMatchesCanonicalFacet(a, facetId) {
    var blob = assetBlobNorm(a);
    if (facetId === "slider") {
      if (/\bslider\b|\bslidery\b/.test(blob)) return true;
      if (String(a.path || "").toLowerCase().indexOf("/slidery") !== -1) return true;
      if (a.asset_role === "web_hero_slider") return true;
      return (a.appearance_tags || []).some(function (t) {
        var n = normTag(t);
        return n === "slidery" || n === "slider";
      });
    }
    if (facetId === "na_sklep") {
      return (a.appearance_tags || []).some(function (t) {
        return normTag(t) === "na sklep";
      });
    }
    if (facetId === "baner") {
      if (/\bbaner\b/.test(blob)) return true;
      return (a.appearance_tags || []).some(function (t) {
        return normTag(t) === "baner";
      });
    }
    if (facetId === "parowka") return /parowk/.test(blob);
    if (facetId === "niemiesa") return /niemies/.test(blob);
    if (facetId === "indeks_glikemiczny") return /indeks\s*glik|niski\s*ig|\bniski\b.*\big\b/.test(blob);
    if (facetId === "lemon_cheesecake") return /lemon\s*cheesecake|cheesecake\s*lemon/.test(blob);
    if (facetId === "bez_cukru") return /bez\s*cukru/.test(blob);
    if (facetId === "super_cena") return /super\s*cena/.test(blob);
    var def = CANONICAL_BY_ID[facetId];
    var term = def ? normTag(def.label) : normTag(String(facetId || "").replace(/_/g, " "));
    if (blob.indexOf(term) !== -1) return true;
    return (a.appearance_tags || []).some(function (t) {
      var n = normTag(t);
      return n === term || n.indexOf(term) !== -1 || term.indexOf(n) !== -1;
    });
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function bridgeUrl() {
    return window.DamRuntime && DamRuntime.bridgeUrl ? DamRuntime.bridgeUrl() : "http://127.0.0.1:8766";
  }

  function mediaUrl(path, asset) {
    if (window.DamMediaPreview && typeof window.DamMediaPreview.previewUrl === "function") {
      var hi = window.DamMediaPreview.previewUrl(path, asset);
      if (hi) return hi;
    }
    var ext = ((path || "").split(".").pop() || "").toLowerCase();
    var mt = (asset && asset.media_type) || "";
    if (
      mt !== "video" &&
      path &&
      window.DamPreviewTruth &&
      typeof DamPreviewTruth.thumbCacheUrl === "function" &&
      /^(png|jpe?g|webp|gif|tif|tiff|bmp)$/i.test(ext)
    ) {
      return DamPreviewTruth.thumbCacheUrl(path, "card");
    }
    return rawMediaUrl(path);
  }

  function localMediaPath(path) {
    if (window.DamPaths && typeof window.DamPaths.toLocal === "function") {
      return window.DamPaths.toLocal(path);
    }
    return path || "";
  }

  function rawMediaUrl(path) {
    return bridgeUrl() + "/media?path=" + encodeURIComponent(localMediaPath(path));
  }

  function hasActiveDiscoveryFilters() {
    var bounds = dateRangeBounds();
    return !!(
      elVal("damBrandingSearch") ||
      discoveryWhen ||
      Object.keys(activeTagFilters).length ||
      bounds.from != null ||
      bounds.to != null
    );
  }

  function clearAllBrandingFilters() {
    var search = document.getElementById("damBrandingSearch");
    if (search) search.value = "";
    discoveryWhen = "";
    applyDatePreset("");
    var sortEl = document.getElementById("damBrandingSort");
    if (sortEl) sortEl.value = "priority";
    clearTagFilters();
    renderActiveSection();
  }

  function elVal(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || "").trim() : "";
  }

  function includeArchive() {
    var cb = document.getElementById("damBrandingIncludeArchive");
    return cb && cb.checked;
  }

  function normTag(s) {
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
      .trim();
  }

  function appearanceKey(label) {
    return "appearance:" + normTag(label);
  }

  function normalizeMediaType(mt) {
    if (window.DamAssetTaxonomy && DamAssetTaxonomy.normalizeMediaType) {
      return DamAssetTaxonomy.normalizeMediaType(mt);
    }
    var m = String(mt || "").toLowerCase();
    return m === "raster" ? "image" : m;
  }

  function isGraphicMedia(a) {
    var mt = normalizeMediaType(a.media_type);
    /* "Grafika" w UI = gotowy obraz/wektor. Zrodla (PSD/AI) = osobny tag Zrodlo. */
    return mt === "image" || mt === "vector";
  }

  /** Pliki źródłowe (PSD/PSB/AI/INDD…) — nie gotowy JPG/PNG. Tag Edytowalny na JPG zostaje. */
  function isSourceEditableAsset(a) {
    if (!a) return false;
    var mt = normalizeMediaType(a.media_type);
    if (mt === "source") return true;
    if (String(a.asset_role || "") === "artwork_source") return true;
    var ext = String((a.name || a.path) || "")
      .split(".")
      .pop()
      .toLowerCase();
    /* Ext wygrywa nawet gdy indeks blednie dal media_type=image */
    return /^(psd|psb|ai|indd|indt|eps)$/.test(ext);
  }

  function passesGraphicsOnlyFilter(a) {
    if (!graphicsOnlyActive()) return true;
    /* Jawny tag Dokument / Wideo / Zrodlo / Element produktu nadpisuje przelacznik */
    if (
      activeTagFilters["media:document"] ||
      activeTagFilters["media:video"] ||
      activeTagFilters["media:source"] ||
      activeTagFilters["format:editable"] ||
      activeTagFilters["role:product_element"]
    ) {
      return true;
    }
    var mt = normalizeMediaType(a.media_type);
    if (mt === "document" || mt === "video") return false;
    if (isSourceEditableAsset(a)) return false;
    /* Elementy produktu (wycinki/warstwy) = nie gotowa grafika marketingowa */
    if (String(a.asset_role || "") === "product_element") return false;
    var ext = String((a && (a.name || a.path)) || "")
      .split(".")
      .pop()
      .toLowerCase();
    if (/^(mp4|mov|webm|avi|mkv|m4v)$/.test(ext)) return false;
    if (/^(psd|psb|ai|indd|indt|eps)$/.test(ext)) return false;
    return true;
  }

  /**
   * Liczniki tagow media:/format: liczymy BEZ wykluczenia "Tylko grafiki" -
   * klik w Wideo/Dokument jawnie nadpisuje przelacznik (passesGraphicsOnlyFilter),
   * wiec tag nie moze byc wygaszony z licznikiem 0, gdy materialy istnieja.
   */
  function chipCountIgnoresGraphicsOnly(key) {
    return String(key || "").indexOf("media:") === 0 || String(key || "").indexOf("format:") === 0;
  }

  function graphicsOnlyActive() {
    var cb = document.getElementById("damBrandingGraphicsOnly");
    if (cb) return cb.checked;
    return !!elVal("damBrandingSearch");
  }

  function assetMatchesTagKey(a, key) {
    if (!key) return true;
    var parts = key.split(":");
    var kind = parts[0];
    var val = parts.slice(1).join(":");
    if (kind === "media") {
      if (val === "graphic") return isGraphicMedia(a);
      return normalizeMediaType(a.media_type) === normalizeMediaType(val);
    }
    if (kind === "role") return a.asset_role === val;
    if (kind === "format") {
      if (val === "transparent") {
        if (window.DamAssetTaxonomy && DamAssetTaxonomy.isEffectiveTransparent) {
          return DamAssetTaxonomy.isEffectiveTransparent(a);
        }
        return (
          (a.format_technical || []).indexOf("transparent") !== -1 || a.background === "transparent"
        );
      }
      if (val === "white") {
        if (window.DamAssetTaxonomy && DamAssetTaxonomy.isEffectiveWhite) {
          return DamAssetTaxonomy.isEffectiveWhite(a);
        }
        return (a.format_technical || []).indexOf("white") !== -1 || a.background === "white";
      }
      return (a.format_technical || []).indexOf(val) !== -1;
    }
    if (kind === "perspective") return a.perspective === val;
    if (kind === "size") return a.size === val;
    if (kind === "background") return a.background === val;
    if (kind === "brand") return a.brand === val;
    if (kind === "channel") return assetMatchesChannel(a, val);
    if (kind === "appearance") {
      return (a.appearance_tags || []).some(function (t) {
        return normTag(t) === normTag(val);
      });
    }
    if (kind === "author") {
      return assetMatchesAuthor(a, val);
    }
    if (kind === "facet") {
      return assetMatchesCanonicalFacet(a, val);
    }
    if (kind === "tag") {
      return (a.tags || []).indexOf(val) !== -1;
    }
    return true;
  }

  /** B4: author field (gdy indeks ma) + appearance_tags + path/name (Highlite/krz). */
  function assetMatchesAuthor(a, val) {
    if (!a || !val) return false;
    var want = normTag(val);
    if (!want) return false;
    if (a.author && normTag(a.author) === want) return true;
    if (
      Array.isArray(a.authors) &&
      a.authors.some(function (t) {
        return normTag(t) === want;
      })
    ) {
      return true;
    }
    if (
      (a.appearance_tags || []).some(function (t) {
        return normTag(t) === want;
      })
    ) {
      return true;
    }
    var blob = String(
      (a.path || "") + " " + (a.name || "") + " " + (a.search_blob || "")
    ).toLowerCase();
    if (blob.indexOf(String(val).toLowerCase()) !== -1) return true;
    if (want === "krzysztof" && /\bkrz\b|krzysztof/.test(blob)) return true;
    if (want === "highlite" && /highlite|highlight/.test(blob)) return true;
    return false;
  }

  function assetMatchesActiveTags(a) {
    var keys = Object.keys(activeTagFilters);
    for (var i = 0; i < keys.length; i++) {
      if (!activeTagFilters[keys[i]]) continue;
      if (!assetMatchesTagKey(a, keys[i])) return false;
    }
    return true;
  }

  var SEARCH_SYNONYM_MAP = {
    "bez tla": ["przezroczyste", "transparent", "przezroczyste tlo"],
    "tlo usuniete": ["przezroczyste", "transparent", "przezroczyste tlo"],
    "przezroczyste": ["transparent", "przezroczyste tlo", "bez tla"],
    "przezroczyste tlo": ["transparent", "przezroczyste"],
    "tlo przezroczyste": ["transparent", "przezroczyste tlo", "przezroczyste"],
    "biale": ["white", "tlo biale", "biale tlo"],
    "biale tlo": ["white", "tlo biale"],
    "tlo biale": ["white", "biale tlo"],
  };

  function rawSearchTokens(q) {
    return String(q || "")
      .toLowerCase()
      .split(/\s+/)
      .map(function (t) {
        return normTag(t);
      })
      .filter(Boolean);
  }

  /**
   * Grupy tokenow do dopasowania: kazdy token usera to grupa [token + synonimy].
   * Materiał pasuje, gdy KAŻDA grupa ma w blobie CO NAJMNIEJ JEDNĄ alternatywę
   * (synonimy to OR, nie AND — inaczej „przezroczyste” dawało 0 wyników).
   */
  function searchTokenGroups(q) {
    return rawSearchTokens(q).map(function (t) {
      var alts = [t];
      (SEARCH_SYNONYM_MAP[t] || []).forEach(function (s) {
        var ns = normTag(s);
        if (ns && alts.indexOf(ns) === -1) alts.push(ns);
      });
      return alts;
    });
  }

  function searchTokens(q) {
    var raw = rawSearchTokens(q);
    if (!raw.length) return [];
    var out = [];
    var seen = {};
    raw.forEach(function (t) {
      if (!seen[t]) {
        seen[t] = true;
        out.push(t);
      }
      var syns = SEARCH_SYNONYM_MAP[t];
      if (syns) {
        syns.forEach(function (s) {
          var ns = normTag(s);
          if (ns && !seen[ns]) {
            seen[ns] = true;
            out.push(ns);
          }
        });
      }
    });
    return out;
  }

  function searchScore(a, tokens) {
    if (!tokens.length) return 0;
    var blob = normTag(
      (a.search_blob || "") +
        " " +
        (a.name || "") +
        " " +
        (a.appearance_tags || []).join(" ") +
        " " +
        (a.tags || []).join(" ")
    );
    var score = 0;
    tokens.forEach(function (t) {
      if (!t) return;
      if (blob.indexOf(t) !== -1) score += 12;
      (a.appearance_tags || []).forEach(function (tag) {
        if (normTag(tag).indexOf(t) !== -1) score += 28;
      });
      if (normTag(a.name || "").indexOf(t) !== -1) score += 18;
    });
    if (isGraphicMedia(a)) score += 8;
    if (a.media_type === "document") score -= 24;
    if ((a.appearance_tags || []).length) score += 4;
    return score;
  }

  function sortByRelevance(list, q) {
    var tokens = searchTokens(q);
    if (!tokens.length) return list;
    return list
      .map(function (a, i) {
        return { a: a, s: searchScore(a, tokens), i: i };
      })
      .sort(function (x, y) {
        if (y.s !== x.s) return y.s - x.s;
        return compareAssetsForDisplay(x.a, y.a, x.i, y.i);
      })
      .map(function (row) {
        return row.a;
      });
  }

  function assetDisplayPriority(a) {
    if (window.DamAssetTaxonomy && typeof DamAssetTaxonomy.displayPriority === "function") {
      return DamAssetTaxonomy.displayPriority(a);
    }
    return 5;
  }

  /**
   * Priorytet użycia = segregacja katalogowa (HARD 2026-07-21):
   * 1) klaster sekcji (WWW / Social / Kampanie / …) — WWW (strona DK) najpierw
   * 2) płytsze foldery wyżej (głębiej w drzewie = niżej w siatce)
   * 3) nowszy rok w ścieżce wyżej (kampania 2026 przed 2021 w tym samym klastrze)
   * 4) rola assetu (DamAssetTaxonomy.displayPriority)
   */
  function folderClusterRank(a) {
    var p = String((a && a.path) || "")
      .replace(/\\/g, "/")
      .toUpperCase();
    if (/\/--?\s*ARCHIWUM|\/ARCHIWUM\//.test(p)) return 90;
    var sec = typeof assetSectionId === "function" ? assetSectionId(a) : "other";
    if (sec === "www") return 10;
    if (sec === "social") return 20;
    if (sec === "campaigns") return 30;
    if (sec === "brandbook") return 40;
    if (sec === "packshots") return 45;
    return 50;
  }

  function folderDepthRank(a) {
    var sec = typeof assetSectionId === "function" ? assetSectionId(a) : "";
    var parts =
      sec && typeof sectionRelativeParts === "function"
        ? sectionRelativeParts(a && a.path, sec)
        : [];
    if (parts && parts.length) return parts.length;
    var p = String((a && a.path) || "").replace(/\\/g, "/");
    var up = p.toUpperCase();
    var idx = up.indexOf("/MARKETING/");
    if (idx < 0) idx = up.indexOf("MARKETING/");
    var tail = (idx >= 0 ? p.slice(idx) : p).split("/").filter(Boolean);
    return Math.min(Math.max(tail.length - 1, 0), 14);
  }

  function folderYearRank(a) {
    var y = extractYearFromAsset(a);
    var n = parseInt(y, 10);
    return isNaN(n) ? 0 : n;
  }

  function assetMtimeMs(a) {
    if (!a) return 0;
    if (typeof a.mtime_ms === "number" && a.mtime_ms > 0) return a.mtime_ms;
    if (a.mtime) {
      var t = Date.parse(a.mtime);
      if (!isNaN(t)) return t;
    }
    var name = String(a.name || "");
    var m = /^(\d{4})(\d{2})(\d{2})/.exec(name);
    if (m) {
      var d = Date.parse(m[1] + "-" + m[2] + "-" + m[3] + "T12:00:00Z");
      if (!isNaN(d)) return d;
    }
    var y = extractYearFromAsset(a);
    if (y) return Date.parse(String(y) + "-06-15T12:00:00Z") || 0;
    return 0;
  }

  function currentSortMode() {
    var el = document.getElementById("damBrandingSort");
    return el && el.value ? el.value : "priority";
  }

  function compareAssetsForDisplay(a, b, ia, ib) {
    var mode = currentSortMode();
    var ma = assetMtimeMs(a);
    var mb = assetMtimeMs(b);
    if (mode === "newest") {
      if (mb !== ma) return mb - ma;
    } else if (mode === "oldest") {
      if (ma !== mb) return ma - mb;
    } else if (mode === "name") {
      var na = String(a.name || "").localeCompare(String(b.name || ""), "pl");
      if (na) return na;
    } else {
      /* priority = folder cluster → depth → year → role → mtime */
      var ca = folderClusterRank(a);
      var cb = folderClusterRank(b);
      if (ca !== cb) return ca - cb;
      var da = folderDepthRank(a);
      var db = folderDepthRank(b);
      if (da !== db) return da - db;
      var ya = folderYearRank(a);
      var yb = folderYearRank(b);
      if (ya !== yb) return yb - ya;
      var pa = assetDisplayPriority(a);
      var pb = assetDisplayPriority(b);
      if (pa !== pb) return pa - pb;
      if (mb !== ma) return mb - ma;
    }
    var n2 = String(a.name || "").localeCompare(String(b.name || ""), "pl");
    if (n2) return n2;
    return (ia || 0) - (ib || 0);
  }

  function asAssetList(list) {
    return Array.isArray(list) ? list : [];
  }

  function sortAssetsForDisplay(list, q) {
    list = asAssetList(list);
    var withQ = q ? sortByRelevance(list, q) : list.slice();
    if (q) return withQ;
    return withQ
      .map(function (a, i) {
        return { a: a, i: i };
      })
      .sort(function (x, y) {
        return compareAssetsForDisplay(x.a, y.a, x.i, y.i);
      })
      .map(function (row) {
        return row.a;
      });
  }

  function dateRangeBounds() {
    var fromEl = document.getElementById("damBrandingDateFrom");
    var toEl = document.getElementById("damBrandingDateTo");
    var from = fromEl && fromEl.value ? Date.parse(fromEl.value + "T00:00:00") : NaN;
    var to = toEl && toEl.value ? Date.parse(toEl.value + "T23:59:59.999") : NaN;
    return {
      from: isNaN(from) ? null : from,
      to: isNaN(to) ? null : to,
    };
  }

  function assetMatchesDateRange(a) {
    var bounds = dateRangeBounds();
    if (bounds.from == null && bounds.to == null) return true;
    var ms = assetMtimeMs(a);
    if (!ms) return false;
    if (bounds.from != null && ms < bounds.from) return false;
    if (bounds.to != null && ms > bounds.to) return false;
    return true;
  }

  function isoDate(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function applyDatePreset(preset) {
    var fromEl = document.getElementById("damBrandingDateFrom");
    var toEl = document.getElementById("damBrandingDateTo");
    if (!fromEl || !toEl) return;
    var now = new Date();
    datePresetActive = preset || "";
    if (preset === "week") {
      var w = new Date(now.getTime() - 7 * 86400000);
      fromEl.value = isoDate(w);
      toEl.value = isoDate(now);
    } else if (preset === "month") {
      var m = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      fromEl.value = isoDate(m);
      toEl.value = isoDate(now);
    } else if (preset === "2026") {
      fromEl.value = "2026-01-01";
      toEl.value = "2026-12-31";
    } else if (preset === "2025") {
      fromEl.value = "2025-01-01";
      toEl.value = "2025-12-31";
    } else {
      fromEl.value = "";
      toEl.value = "";
      datePresetActive = "";
    }
    syncDatePresetButtons();
  }

  function syncDatePresetButtons() {
    var host = document.getElementById("damBrandingDatePresets");
    if (!host) return;
    host.querySelectorAll("button[data-preset]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-preset") === datePresetActive);
    });
  }

  function setBootStatus(msg) {
    var el = document.getElementById("damBrandingStatus");
    if (el) el.textContent = msg;
    /* Indeks wolny: utrzymuj skeleton w siatce (nie zostawiaj pustego paska statusu). */
    if (!index && msg) showInitialBootSkeletons();
  }

  async function loadSearchIndex() {
    if (searchIndex) return searchIndex;
    searchIndex = { by_tag: {} };
    try {
      var r = await fetch(bridgeUrl() + "/branding-search-index?v=" + CB);
      if (r.ok) searchIndex = await r.json();
    } catch (eIdx) {
      /* bridge offline lub stary most bez tej trasy */
    }
    if (!searchIndex) searchIndex = { by_tag: {} };
    return searchIndex;
  }

  function applyBadgeFilter(kind, value, opts) {
    opts = opts || {};
    var key = kind;
    if (
      kind === "appearance" ||
      kind === "media" ||
      kind === "perspective" ||
      kind === "size" ||
      kind === "brand" ||
      kind === "channel" ||
      kind === "tag"
    ) {
      key = kind + ":" + (kind === "appearance" ? normTag(value) : value);
    } else if (String(kind || "").indexOf(":") === -1) {
      key = appearanceKey(value || kind);
    }
    if (!opts.append) {
      activeTagFilters = {};
    }
    activeTagFilters[key] = true;
    if (kind === "appearance" && !opts.append) {
      var search = document.getElementById("damBrandingSearch");
      if (search) search.value = String(value || "").trim();
    }
    renderTagFilters();
    var facetTab = tabForFacetKey(key);
    if (facetTab) {
      activateTab(facetTab, { skipHash: true, keepDiscovery: true });
    } else {
      renderActiveSection();
    }
  }

  var FILTER_BADGE_CLASS = {
    skojarzenia: "dam-viz-badge--cat",
    kiedy: "dam-viz-badge--carrier",
    kolekcje: "dam-viz-badge--subcat",
    co: "dam-viz-badge--lang",
    format_pliku: "dam-viz-badge--carrier",
    przeznaczenie: "dam-viz-badge--cat",
    cechy: "dam-viz-badge--lang",
    wizualizacja: "dam-viz-badge--subcat",
    kanal: "dam-viz-badge--lang",
    marka: "dam-viz-badge--brand",
    autor: "dam-viz-badge--lang",
    produkt: "dam-viz-badge--subcat",
  };

  var FILTER_GROUP_LABELS = {
    skojarzenia: "Skojarzenia",
    kiedy: "Kiedy",
    kolekcje: "Kolekcje",
    co: "Co",
    format_pliku: "Format pliku",
    przeznaczenie: "Przeznaczenie",
    cechy: "Cechy pliku",
    wizualizacja: "Wizualizacja",
    kanal: "Kanał",
    marka: "Marka",
    autor: "Autor",
    produkt: "Produkt",
  };

  function assetRoleChipsFromIndex() {
    var counts = {};
    (index && index.assets ? index.assets : []).forEach(function (a) {
      if (!a.asset_role) return;
      counts[a.asset_role] = (counts[a.asset_role] || 0) + 1;
    });
    var order =
      window.DamAssetTaxonomy && DamAssetTaxonomy.ASSET_ROLE_ORDER
        ? DamAssetTaxonomy.ASSET_ROLE_ORDER
        : Object.keys(counts);
    var chips = [];
    order.forEach(function (code) {
      if (!counts[code]) return;
      var label =
        window.DamAssetTaxonomy && DamAssetTaxonomy.assetRoleLabel
          ? DamAssetTaxonomy.assetRoleLabel(code)
          : code;
      chips.push({ key: "role:" + code, label: label, group: "przeznaczenie" });
    });
    Object.keys(counts).forEach(function (code) {
      if (order.indexOf(code) !== -1) return;
      var label =
        window.DamAssetTaxonomy && DamAssetTaxonomy.assetRoleLabel
          ? DamAssetTaxonomy.assetRoleLabel(code)
          : code;
      chips.push({ key: "role:" + code, label: label, group: "przeznaczenie" });
    });
    return chips;
  }

  function normalizeLogoStem(name) {
    return String(name || "")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[_]+/g, " ")
      .replace(/\s*-\s*/g, " ")
      .replace(
        /\b(krz|myk|rgb|cmyk|mono|white|black|kolor|wersja|version|tagline|horizontal|vertical|pion|poziom|pl|en|de|fr)\b/gi,
        " "
      )
      .replace(/\b(logo|logotyp|znak)\b/gi, " ")
      .replace(/\s*\d+\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function isLogoAsset(a) {
    var blob = ((a.path || "") + " " + (a.name || "") + " " + (a.search_blob || "")).toLowerCase();
    return /\blogo\b|logotyp|brandbook|favicon|znak\s*firmowy/.test(blob);
  }

  function logoGroupKey(a) {
    if (!isLogoAsset(a)) return "";
    var blob = ((a.path || "") + " " + (a.name || "")).toLowerCase();
    if (/kubara/.test(blob)) return "logo:kubara";
    if (/good\s*calories|good-calories|\bgc\b/.test(blob) || blob.indexOf("/gc/") !== -1) return "logo:gc";
    if (/dobra\s*kaloria|dobra-kaloria/.test(blob) || a.brand === "DK") return "logo:dk";
    var stem = normalizeLogoStem(a.name);
    if (stem.length < 2) stem = "logo";
    return "logo:" + normTag(stem).slice(0, 36);
  }

  function pickPrimaryAsset(assets) {
    return assets
      .slice()
      .sort(function (a, b) {
        var score = function (x) {
          var s = 0;
          if (/\.(png|jpe?g|webp)$/i.test(x.name || "")) s += 24;
          if (x.media_type === "raster") s += 12;
          if (/\.(ai|eps|svg)$/i.test(x.name || "")) s -= 6;
          if (/\.(psd|psb)$/i.test(x.name || "")) s -= 2;
          return s;
        };
        return score(b) - score(a);
      })[0];
  }

  function wizkiPathParts(path) {
    var p = String(path || "").replace(/\\/g, "/");
    var parts = p.split("/").filter(Boolean);
    var wizIdx = -1;
    for (var i = 0; i < parts.length; i++) {
      if (/^4\s*-\s*(WIZKI|VISUALS)$/i.test(parts[i])) {
        wizIdx = i;
        break;
      }
    }
    if (wizIdx < 1) return null;
    return {
      revFolder: parts[wizIdx - 1],
      prodFolder: wizIdx >= 2 ? parts[wizIdx - 2] : "",
      groupPath: parts.slice(0, wizIdx).join("/").toLowerCase(),
    };
  }

  function cleanFolderName(name) {
    if (!name) return "";
    if (window.DamLabels && typeof window.DamLabels.cleanProductDisplayName === "function") {
      return window.DamLabels.cleanProductDisplayName(name) || name;
    }
    return name;
  }

  function keyVisualGroupKey(a) {
    var info = wizkiPathParts(a.path);
    if (info && info.groupPath) return "rev:" + info.groupPath;
    if (a.linked_product_ids && a.linked_product_ids[0]) {
      var skuPart = a.sku ? "|sku:" + String(a.sku).split(".")[0] : "";
      return "pid:" + a.linked_product_ids[0] + skuPart;
    }
    if (a.sku) return "sku:" + String(a.sku).split(".")[0];
    return "";
  }

  function pickPrimaryKeyVisual(assets) {
    return assets
      .slice()
      .sort(function (a, b) {
        var score = function (x) {
          var s = 0;
          var persp = String(x.perspective || "").toUpperCase();
          if (persp === "FRONT") s += 40;
          else if (persp === "ENFACE") s += 30;
          if (x.size === "XL") s += 24;
          else if (x.size === "L") s += 20;
          else if (x.size === "S" || x.size === "S_SKLEP") s += 10;
          if (/\.png$/i.test(x.name || "")) s += 8;
          else if (/\.jpe?g$/i.test(x.name || "")) s += 6;
          return s;
        };
        return score(b) - score(a);
      })[0];
  }

  function keyVisualGroupLabel(assets) {
    var primary = pickPrimaryKeyVisual(assets) || assets[0];
    if (!primary) return "Key visual";
    var info = wizkiPathParts(primary.path);
    if (info) {
      var prod = cleanFolderName(info.prodFolder);
      var rev = cleanFolderName(info.revFolder);
      if (prod && rev && prod !== rev && rev.indexOf(prod) === -1) return prod + " · " + rev;
      return rev || prod || "Key visual";
    }
    if (primary.sku) return "Indeks " + String(primary.sku).split(".")[0];
    return String(primary.name || "Key visual").replace(/\.[a-z0-9]+$/i, "");
  }

  function keyVisualGroupMeta(assets) {
    assets = assets || [];
    if (!assets.length) return "";
    var perspectives = {};
    var sizes = {};
    assets.forEach(function (a) {
      if (a.perspective) perspectives[a.perspective] = true;
      if (a.size) sizes[a.size] = true;
    });
    var primary = pickPrimaryKeyVisual(assets) || assets[0];
    var sku = primary && primary.sku ? String(primary.sku).split(".")[0] : "";
    var parts = [];
    if (sku) parts.push("Indeks " + sku);
    parts.push(assets.length + (assets.length === 1 ? " plik" : " plików"));
    var pCount = Object.keys(perspectives).length;
    if (pCount > 1) parts.push(pCount + " persp.");
    var sCount = Object.keys(sizes).length;
    if (sCount > 1) parts.push(sCount + " rozmiary");
    return parts.join(" · ");
  }

  function groupKeyVisualAssets(list) {
    list = asAssetList(list);
    var byKey = {};
    var order = [];
    list.forEach(function (a) {
      var key = keyVisualGroupKey(a);
      if (!key) {
        order.push({ type: "single", id: a.id });
        return;
      }
      if (!byKey[key]) {
        byKey[key] = [];
        order.push({ type: "group", key: key });
      }
      byKey[key].push(a);
    });
    var out = [];
    var seen = {};
    order.forEach(function (item) {
      if (item.type === "single") {
        var one = list.find(function (x) {
          return x.id === item.id;
        });
        if (one) out.push({ type: "single", assets: [one] });
        return;
      }
      if (seen[item.key]) return;
      seen[item.key] = true;
      var bucket = byKey[item.key] || [];
      if (bucket.length < 2) {
        bucket.forEach(function (a) {
          out.push({ type: "single", assets: [a] });
        });
        return;
      }
      var sorted = bucket.slice().sort(function (a, b) {
        var pa = String(a.perspective || "");
        var pb = String(b.perspective || "");
        if (pa !== pb) return pa.localeCompare(pb, "pl");
        var sa = String(a.size || "");
        var sb = String(b.size || "");
        if (sa !== sb) return sa.localeCompare(sb, "pl");
        return String(a.name || "").localeCompare(String(b.name || ""), "pl");
      });
      out.push({
        type: "group",
        assets: sorted,
        primary: pickPrimaryKeyVisual(sorted),
        label: keyVisualGroupLabel(sorted),
      });
    });
    return out;
  }

  var QUICK_ASSOCIATIONS = [
    "burger",
    "grill",
    "proteina",
    "baton",
    "kulki",
    "parówka",
    "niemięsa",
    "slider",
    "wideo",
    "rossmann",
    "lidl",
    "biedronka",
    "key visual",
    "kampania",
    "promocja",
    "justtag",
    "listonic",
    "google ads",
    "meta",
    "tiktok",
    "reels",
    "logo",
    "banoffee",
    "tiramisu",
    "kiełbaski",
    "falafel",
    "nuggets",
    "doypack",
    "super cena",
    "back to school",
    "black friday",
    "wielkanoc",
    "święta",
    "indeks glikemiczny",
    "mini baton",
    "boost",
    "bez cukru",
    "nerkowcowy",
    "orzech",
    "kaszanka",
    "plansza",
    "gif",
    "animacja",
    "packshot",
    "baner",
    "karmel",
    "deserowe",
    "mix",
    "tuba",
    "folia",
  ];

  var WHEN_CHIPS = [
    { id: "2026", label: "2026" },
    { id: "2025", label: "2025" },
    { id: "2024", label: "2024" },
    { id: "grill", label: "Grill / lato" },
    { id: "jesien", label: "Jesień" },
    { id: "zima", label: "Zima" },
    { id: "święta", label: "Święta" },
    { id: "wielkanoc", label: "Wielkanoc" },
    { id: "walentynki", label: "Walentynki" },
    { id: "dzienmatki", label: "Dzień matki" },
    { id: "backtoschool", label: "Back to school" },
    { id: "blackfriday", label: "Black Friday" },
    { id: "q1", label: "Q1" },
    { id: "q2", label: "Q2" },
    { id: "q3", label: "Q3" },
    { id: "q4", label: "Q4" },
  ];

  var WHAT_TILES = [
    { label: "Burger", search: "burger" },
    { label: "Proteina", appearance: "Proteina" },
    { label: "Baton", appearance: "Baton" },
    { label: "Kulki", appearance: "Kulki" },
    { label: "Parówka", search: "parowka" },
    { label: "Grill", search: "grill" },
    { label: "Niemięsa", search: "niemies" },
    { label: "Datesy", appearance: "Datesy" },
    { label: "Banoffee", appearance: "Banoffee" },
    { label: "Karmel", appearance: "Karmel" },
    { label: "Mix", appearance: "Mix" },
    { label: "Doypack", appearance: "Doypack" },
    { label: "Boost", appearance: "Boost" },
    { label: "Mini", appearance: "Mini" },
    { label: "MCT", appearance: "MCT" },
    { label: "Deserowe", appearance: "Deserowe" },
    { label: "Sypkie", appearance: "Sypkie" },
    { label: "Folia", appearance: "Folia" },
    { label: "Kiełbaski", search: "kielbask" },
    { label: "Falafel", search: "falafel" },
    { label: "Nuggets", search: "nugget" },
    { label: "Kaszanka", search: "kaszank" },
    { label: "Nerkowcowy", search: "nerkowc" },
    { label: "Orzech", search: "orzech" },
  ];

  var CURATED_COLLECTIONS = [
    { id: "grill26", label: "Grill 2026", when: "2026", search: "grill", tab: "campaigns" },
    { id: "proteina", label: "Proteina", search: "proteina" },
    { id: "socialfilm", label: "Filmy social", tab: "social", media: "video" },
    { id: "slidery", label: "Slider sklepu", tab: "www", facet: "slider" },
    { id: "packshoty", label: "Packshoty produktów", tab: "packshots" },
    { id: "wielkanoc26", label: "Wielkanoc 2026", when: "wielkanoc", search: "wielkanoc", tab: "campaigns" },
    { id: "święta25", label: "Święta 2025", when: "święta", search: "święta", tab: "campaigns" },
    { id: "rossmann", label: "Rossmann", search: "rossmann", tab: "campaigns" },
    { id: "lidl", label: "Lidl", search: "lidl", tab: "campaigns" },
    { id: "burgerkamp", label: "Burger — kampania", search: "burger", tab: "campaigns" },
    { id: "niemiesa", label: "Niemięsa", search: "niemięsa", tab: "campaigns" },
    { id: "googleads", label: "Google Ads", search: "google ads", tab: "campaigns" },
    { id: "metastories", label: "Meta / Stories", search: "meta", tab: "social" },
    { id: "tiktok", label: "TikTok", search: "tiktok", tab: "social" },
    { id: "reels", label: "Reels Instagram", search: "reels", tab: "social" },
    { id: "keyvisuale", label: "Key visuale XL", tab: "packshots", appearance: "Proteina" },
    { id: "logodk", label: "Logo DK", search: "logo dobra kaloria", tab: "brandbook" },
    { id: "logogc", label: "Logo GC", search: "good calories", tab: "brandbook" },
    { id: "brandbookkolory", label: "Brandbook — kolory", tab: "brandbook", search: "brandbook" },
    { id: "promocja5", label: "Promocja 5 zł", search: "5 zł", tab: "www" },
    { id: "nasklep", label: "Na sklep", tab: "www", facet: "na_sklep" },
    { id: "backtoschool", label: "Back to school", when: "backtoschool", search: "school", tab: "campaigns" },
    { id: "blackfriday", label: "Black Friday", when: "blackfriday", search: "black friday", tab: "campaigns" },
  ];

  var SECTION_DESCS = {
    all: "Wszystkie materiały branding, bez zawężenia kategorii.",
    campaigns: "Banery i materiały kampanii.",
    social: "Filmy i animacje na social.",
    www: "Slidery i banery strony.",
    packshots: "Zdjęcia opakowań produktów.",
    brandbook: "Logo, kolory i szablony marki.",
  };

  var SECTION_MARKERS = {
    /* KAMAPANIE = stary typo w markerze; KAMPANIE = kanoniczna nazwa folderu */
    campaigns: /08\s*-\s*KA(?:MAPANIE|MPANIE)/i,
    social: /05\s*-\s*SOCIAL\s*MEDIA/i,
    www: /06\s*-\s*STRONY\s*WWW|07\s*-\s*E-COMMERCE|\/SLIDERY\//i,
    brandbook: /BRANDING\s*I\s*MARKA|BRANDBOOK|BRAND\s*BOOK/i,
  };

  var FACET_TAB_BY_KEY = (function () {
    var map = {};
    FACET_CHIPS.forEach(function (c) {
      if (c.tab) map[c.key] = c.tab;
    });
    CANONICAL_TAGS.forEach(function (c) {
      if (c.tab) map[facetKey(c.id)] = c.tab;
    });
    map["appearance:baner"] = "www";
    map["channel:www"] = "www";
    map["channel:meta"] = "social";
    map["channel:instagram"] = "social";
    map["channel:google"] = "campaigns";
    return map;
  })();

  function tabForFacetKey(key) {
    return FACET_TAB_BY_KEY[key] || "";
  }

  var GENERIC_FOLDER_RE =
    /^(close|final|gif|gifs|export|surowe|raw|temp|old|nowe|nowy|assets?|jpg|png|psd|webp|mp4|mov|wideo|video|final_bez|bez\s*plansz)$/i;

  var TECHNICAL_FOLDER_RE =
    /^(listonic|admetrics|dv360|eska|footage|do\s*edycji|giff|mp4|mov|psd|jpg|png|export|surowe|raw|temp|assets?|final|close|gif|gifs)$/i;

  function isTechnicalFolderName(name) {
    var n = String(name || "").trim();
    if (!n) return true;
    if (isGenericFolderName(n)) return true;
    if (TECHNICAL_FOLDER_RE.test(n)) return true;
    if (/dv360|giff|admetrics|listonic|footage/i.test(n)) return true;
    if (/^[A-Z0-9][A-Z0-9_]{3,}$/.test(n) && /_/.test(n)) return true;
    return false;
  }

  function assetSectionId(a) {
    if (!a) return "other";
    if (a.perspective || a.source === "wizki") return "packshots";
    var p = String(a.path || "").toUpperCase();
    /* 07-E-COMMERCE/02-KAMPANIE E-COMMERCE = materiały kampanii (nie zakładka WWW). */
    if (/02\s*-\s*KAMPANIE\s*E-COMMERCE/i.test(p)) return "campaigns";
    if (SECTION_MARKERS.campaigns.test(p)) return "campaigns";
    if (SECTION_MARKERS.social.test(p)) return "social";
    if (SECTION_MARKERS.www.test(p)) return "www";
    if (SECTION_MARKERS.brandbook.test(p)) return "brandbook";
    return "other";
  }

  function assetInSectionTab(a, tab) {
    if (!a || !tab) return false;
    if (tab === "all") return true;
    if (tab === "packshots") {
      if (!a.perspective) return false;
      return a.size === "XL" || a.size === "L" || a.size === "S" || a.size === "S_SKLEP";
    }
    if (tab === "brandbook") {
      var up = String(a.path || "").toUpperCase();
      return (
        up.indexOf("BRANDING") !== -1 ||
        up.indexOf("BRAND BOOK") !== -1 ||
        up.indexOf("BRANDBOOK") !== -1
      );
    }
    return assetSectionId(a) === tab;
  }

  function showTagCounts() {
    try {
      return localStorage.getItem(TAG_COUNTS_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function setShowTagCounts(on) {
    try {
      localStorage.setItem(TAG_COUNTS_KEY, on ? "1" : "0");
    } catch (e) {
      /* ignore */
    }
  }

  function sectionRelativeParts(path, sectionId) {
    var marker = SECTION_MARKERS[sectionId];
    if (!marker) return [];
    var p = String(path || "").replace(/\\/g, "/");
    var m = p.match(marker);
    if (!m) return [];
    var idx = p.toUpperCase().indexOf(m[0].toUpperCase());
    if (idx < 0) return [];
    var tail = p.slice(idx + m[0].length).replace(/^\//, "").split("/");
    tail.pop();
    return tail.filter(Boolean);
  }

  function sectionRelativeKey(path, sectionId) {
    return sectionRelativeParts(path, sectionId).join("/").toLowerCase();
  }

  function pathDirname(path) {
    var p = String(path || "").replace(/\\/g, "/");
    var parts = p.split("/");
    parts.pop();
    return parts.join("/");
  }

  function pathBasename(path) {
    var p = String(path || "").replace(/\\/g, "/");
    return p.split("/").pop() || "";
  }

  function fileStem(name) {
    return String(name || "").replace(/\.[a-z0-9]+$/i, "");
  }

  function isGenericFolderName(name) {
    return GENERIC_FOLDER_RE.test(String(name || "").trim());
  }

  /** Foldery typu "01- CHŁODZONE" / "02 – SLIDERY…" — sortowanie katalogu, nie tytuł karty. */
  function isNumberedBucketFolder(name) {
    var n = String(name || "").trim();
    if (!n) return false;
    return /^\d{1,3}\s*[-–—.]\s*\S/.test(n) || /^\d{1,3}\s+[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/.test(n);
  }

  function isWeakFolderLabel(name) {
    var n = String(name || "").trim();
    if (!n) return true;
    if (isGenericFolderName(n) || isTechnicalFolderName(n)) return true;
    if (isNumberedBucketFolder(n)) return true;
    if (/^(backup|www|ikony|statyki)$/i.test(n)) return true;
    return false;
  }

  function meaningfulFolderLabel(path) {
    var parts = String(path || "")
      .replace(/\\/g, "/")
      .split("/")
      .filter(Boolean);
    parts.pop();
    var depth = 0;
    while (
      parts.length > 0 &&
      depth < 8 &&
      (isTechnicalFolderName(parts[parts.length - 1]) ||
        isNumberedBucketFolder(parts[parts.length - 1]))
    ) {
      parts.pop();
      depth++;
    }
    return parts.length ? parts[parts.length - 1] : "";
  }

  function humanizeMarketingFilename(name) {
    var stem = fileStem(name);
    var dateM = stem.match(/^(\d{8})_/);
    var dateStr = "";
    if (dateM) {
      var d = dateM[1];
      dateStr = d.slice(6, 8) + "." + d.slice(4, 6) + "." + d.slice(0, 4);
      stem = stem.slice(9);
    }
    var label = stem.replace(/_/g, " ").replace(/\s+/g, " ").trim();
    if (dateStr) label += " · " + dateStr;
    return label || fileStem(name);
  }

  function marketingGroupKey(a) {
    var dir = pathDirname(a.path);
    var folderName = pathBasename(dir);
    if (isGenericFolderName(folderName)) {
      return "file:" + fileStem(a.name).toLowerCase();
    }
    return "dir:" + dir.toLowerCase();
  }

  function humanizeCampaignLabel(raw) {
    var s = String(raw || "")
      .split(/[\\/]/)
      .pop()
      .replace(/_/g, " ")
      .trim();
    if (!s) return "";
    var m = s.match(/^(\d{4})[-\s]+(.+)$/);
    if (m) {
      var year = m[1];
      var rest = cleanFolderName(m[2]) || m[2];
      if (rest && !/^kampani/i.test(rest)) {
        return rest.charAt(0).toUpperCase() + rest.slice(1) + " · " + year;
      }
    }
    if (/^kampani/i.test(s)) return "";
    return cleanFolderName(s) || s;
  }

  function titleCaseWord(w) {
    if (!w) return "";
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }

  function smartTitleFromFilename(name) {
    var stem = fileStem(name).replace(/-/g, "_");
    var low = stem.toLowerCase();
    var kv = low.match(/kv[_\s-]+(?:dobra[_\s-]+)?([a-ząćęłńóśźż]+)/i);
    if (kv && kv[1] && kv[1].length > 2) return titleCaseWord(kv[1]) + " · KV";
    var simple = low.replace(/[_\s]+/g, " ").trim();
    if (/^statyki$/i.test(simple)) return "Statyki";
    if (/^chapter\d+[_\s]/i.test(simple)) {
      var tail = simple.replace(/^chapter\d+[_\s-]+kv[_\s-]+(?:dobra[_\s-]+)?/i, "").replace(/[_\s]+jpg.*$/i, "").trim();
      if (tail.length > 2 && tail.length < 32) return titleCaseWord(tail.split(/[_\s]+/)[0]) + " · KV";
    }
    if (/^\d{8}_/.test(simple)) return "";
    if (simple.length > 48) return "";
    return "";
  }

  function isGenericAppearanceTag(tag) {
    var k = normTag(tag);
    return !k || k.length < 3 || /^(kampania|kampanie|marketing|wideo|grafika|baner|slider|obraz|raster)$/.test(k);
  }

  function marketingGroupLabel(assets) {
    var primary = pickPrimaryMarketing(assets) || assets[0];
    if (!primary) return "Materiał";
    var campTitle = humanizeCampaignLabel(primary.campaign_id || primary.campaign_name);
    if (campTitle) return campTitle;
    /* Najpierw nazwa pliku — foldery (01- CHŁODZONE) to tylko kubełki sortujące. */
    var smart = smartTitleFromFilename(primary.name);
    if (smart) return smart;
    var human = humanizeMarketingFilename(primary.name);
    if (human && human.length >= 3 && !isWeakFolderLabel(human)) {
      if (human.length > 42) return human.slice(0, 40) + "…";
      return human;
    }
    var tags = (primary.appearance_tags || []).filter(function (t) {
      return !isGenericAppearanceTag(t);
    });
    if (tags.length) return tags.slice(0, 2).join(" · ");
    var folderLabel = meaningfulFolderLabel(primary.path);
    if (folderLabel && !isWeakFolderLabel(folderLabel)) {
      return cleanFolderName(folderLabel);
    }
    if (human) {
      if (human.length > 42) return human.slice(0, 40) + "…";
      return human;
    }
    return primary.name || "Materiał";
  }

  function extractYearFromAsset(a) {
    var parts = sectionRelativeParts(a.path, assetSectionId(a));
    for (var i = 0; i < parts.length; i++) {
      if (/^20\d{2}$/.test(parts[i])) return parts[i];
    }
    var dm = String(a.name || "").match(/^(\d{4})\d{4}_/);
    if (dm) return dm[1];
    return "";
  }

  function marketingGroupMeta(assets) {
    assets = assets || [];
    if (!assets.length) return "";
    var primary = pickPrimaryMarketing(assets) || assets[0];
    var parts = [];
    var year = extractYearFromAsset(primary);
    if (year) parts.push(year);
    var mt = primary.media_type || "";
    if (mt === "video") parts.push("Wideo");
    else if (/slider/i.test(primary.asset_role || "") || /slider/i.test(primary.name || "")) parts.push("Slider");
    else if (/\.gif$/i.test(primary.name || "")) parts.push("GIF");
    parts.push(assets.length + (assets.length === 1 ? " plik" : " pliki"));
    var tags = (primary.appearance_tags || []).slice(0, 2);
    if (tags.length) parts.push(tags.join(", "));
    return parts.join(" · ");
  }

  function pickPrimaryMarketing(assets) {
    return assets
      .slice()
      .sort(function (a, b) {
        var score = function (x) {
          var s = 0;
          if (/\.(png|jpe?g|webp|gif)$/i.test(x.name || "")) s += 40;
          else if (/\.(tif|tiff|psd|psb|bmp)$/i.test(x.name || "")) s += 24;
          if (x.media_type === "video") s += 8;
          if (/desktop/i.test(x.name || "")) s += 8;
          if (/\.psd$/i.test(x.name || "")) s += 4;
          if (/\.(ai|eps)$/i.test(x.name || "")) s -= 4;
          return s;
        };
        return score(b) - score(a);
      })[0];
  }

  function groupMarketingAssets(list) {
    list = asAssetList(list);
    var byKey = {};
    var order = [];
    list.forEach(function (a) {
      var key = marketingGroupKey(a);
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
      if (sorted.length < 2) {
        return { type: "single", assets: sorted };
      }
      return {
        type: "group",
        assets: sorted,
        primary: pickPrimaryMarketing(sorted),
        label: marketingGroupLabel(sorted),
      };
    });
  }

  async function loadAssociations() {
    if (associations) return associations;
    try {
      var r = await fetch("data/product-associations.json?v=" + CB);
      associations = r.ok ? await r.json() : { reverse: {} };
    } catch (eAssoc) {
      associations = { reverse: {} };
    }
    return associations;
  }

  function marketingSearchTokens(a) {
    if (!a) return "";
    var bits = [];
    if (a.id) {
      bits.push(a.id);
      bits.push(String(a.id).replace(/^br-/i, ""));
      var brDigits = String(a.id).replace(/\D/g, "");
      if (brDigits) bits.push(brDigits);
    }
    if (window.DamMarketingId && typeof window.DamMarketingId.format === "function") {
      var mid = window.DamMarketingId.format(a);
      if (mid) {
        bits.push(mid);
        bits.push(mid.replace(/^M-/i, ""));
        var midDigits = String(mid).replace(/\D/g, "");
        if (midDigits) bits.push(midDigits);
      }
    }
    return bits.join(" ");
  }

  function assetBlobNorm(a) {
    var extra = "";
    if (window.DamAssetTaxonomy && DamAssetTaxonomy.isEffectiveTransparent && DamAssetTaxonomy.isEffectiveTransparent(a)) {
      extra = " przezroczyste tlo przezroczyste transparent bez tla tlo usuniete";
    } else if (
      window.DamAssetTaxonomy &&
      DamAssetTaxonomy.isEffectiveWhite &&
      DamAssetTaxonomy.isEffectiveWhite(a)
    ) {
      extra = " biale tlo tlo biale white";
    }
    (a.appearance_tags || []).forEach(function (tag) {
      if (window.DamBadges && typeof window.DamBadges.brandingSearchSynonymsForLabel === "function") {
        extra += " " + window.DamBadges.brandingSearchSynonymsForLabel(tag);
      }
    });
    if (a.campaign_id && window.DamBadges && typeof window.DamBadges.brandingSearchSynonymsForLabel === "function") {
      extra += " kampanie kampanie reklamowe " + String(a.campaign_id).replace(/_/g, " ");
    }
    extra += " " + marketingSearchTokens(a);
    return normTag(
      (a.search_blob || "") +
        " " +
        (a.name || "") +
        " " +
        (a.appearance_tags || []).join(" ") +
        " " +
        (a.campaign_id || "") +
        extra
    );
  }

  function metaAssetIdsForCard(a, siblings) {
    var display = brandingCardDisplayAssets(siblings && siblings.length ? siblings : a ? [a] : []);
    var ids = [];
    display.forEach(function (x) {
      if (x && x.id) ids.push(x.id);
    });
    if (!ids.length) {
      if (siblings && siblings.length) {
        siblings.forEach(function (x) {
          if (x && x.id) ids.push(x.id);
        });
      } else if (a && a.id) {
        ids.push(a.id);
      }
    }
    return ids;
  }

  var BRANDING_SOURCE_EXTS = { psd: 1, psb: 1, ai: 1, indd: 1, eps: 1, pdf: 1 };

  function isBrandingSourceAsset(a) {
    if (!a) return true;
    var name = a.name || a.path || "";
    var ext = String(name).split(".").pop().toLowerCase();
    if (BRANDING_SOURCE_EXTS[ext]) return true;
    var mt = String(a.media_type || "").toLowerCase();
    return mt === "source" || mt === "vector" || mt === "document";
  }

  function brandingCardDisplayAssets(assets) {
    return (assets || []).filter(function (a) {
      return a && a.id && !isBrandingSourceAsset(a);
    });
  }

  function brandingCardIndexLabels(assets) {
    var display = brandingCardDisplayAssets(assets);
    var pool = display.length ? display : (assets || []).filter(function (a) {
      return a && a.id;
    });
    var seen = {};
    var out = [];
    pool.forEach(function (a) {
      var lbl = marketingDisplayId(a);
      if (!lbl || seen[lbl]) return;
      seen[lbl] = true;
      out.push(lbl);
    });
    return out;
  }

  function brandingCardVariantBadgeHtml(displayCount) {
    if (!displayCount || displayCount <= 1) return "";
    return (
      '<span class="dam-viz-card__variant-badge" aria-label="' +
      esc("+" + (displayCount - 1) + " plików") +
      '">+' +
      (displayCount - 1) +
      "</span>"
    );
  }

  function brandingCardIndexBlockHtml(assets) {
    var labels = brandingCardIndexLabels(assets);
    if (!labels.length) return "";
    if (labels.length > 1) {
      return (
        '<div class="dam-viz-card__indexes-anchor">' +
        '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-viz-card__show-indexes" data-dam-tip="Pokaż wszystkie indeksy materiałów (klik = kopiuj)" aria-expanded="false">' +
        '<i class="uil uil-layer-group" aria-hidden="true"></i><span>Pokaż indeksy</span></button>' +
        '<div class="dam-viz-card__indexes-wrap" hidden>' +
        labels
          .map(function (idx) {
            return (
              '<button type="button" class="dam-viz-badge dam-viz-badge--index dam-branding-id-chip dam-viz-card__id-chip" data-copy-id="' +
              esc(idx) +
              '" data-tag-value="' +
              esc(idx) +
              '" data-dam-tip="Kliknij, aby skopiować" aria-label="Kopiuj indeks ' +
              esc(idx) +
              '"><i class="uil uil-copy" aria-hidden="true"></i>' +
              esc(idx) +
              "</button>"
            );
          })
          .join("") +
        "</div></div>"
      );
    }
    var single = labels[0];
    return (
      '<button type="button" class="dam-viz-badge dam-viz-badge--index dam-branding-id-chip dam-viz-card__id-chip" data-copy-id="' +
      esc(single) +
      '" data-tag-value="' +
      esc(single) +
      '" data-dam-tip="Kliknij, aby skopiować" aria-label="Kopiuj indeks ' +
      esc(single) +
      '"><i class="uil uil-copy" aria-hidden="true"></i>' +
      esc(single) +
      "</button>"
    );
  }

  function brandingCardMetaHtml(metaText, assetIds) {
    var ids = (assetIds || []).filter(Boolean);
    var emptyCls = metaText ? "" : " dam-viz-card__meta--empty";
    return (
      '<p class="dam-viz-card__meta' +
      emptyCls +
      '" data-branding-meta-ids="' +
      esc(ids.join(",")) +
      '">' +
      esc(metaText || "Materiał") +
      "</p>"
    );
  }

  function brandingCardTitleHtml(displayTitle, subtitleHtml, idChipHtml) {
    return (
      '<div class="dam-viz-card__title-wrap">' +
      '<h5 class="dam-viz-card__title" title="' +
      esc(displayTitle) +
      '">' +
      esc(displayTitle) +
      (subtitleHtml || "") +
      "</h5>" +
      (idChipHtml || "") +
      "</div>"
    );
  }

  /** Kopiowalny chip ID marketingowego przy tytule karty (klik = kopiuj). */
  function brandingCardIdChipHtml(a) {
    if (!a || !a.id) return "";
    var displayId = marketingDisplayId(a);
    if (!displayId) return "";
    return (
      '<button type="button" class="dam-viz-badge dam-viz-badge--index dam-branding-id-chip dam-branding-card__id-chip" data-copy-id="' +
      esc(displayId) +
      '" data-tag-value="' +
      esc(displayId) +
      '" data-dam-tip="Kliknij, aby skopiować" aria-label="Kopiuj ID ' +
      esc(displayId) +
      '"><i class="uil uil-copy" aria-hidden="true"></i>' +
      esc(displayId) +
      "</button>"
    );
  }

  function associationProductIdsForTokens(tokens) {
    var rev = (associations && associations.reverse) || {};
    var ids = {};
    (tokens || []).forEach(function (t) {
      var nt = normTag(t);
      if (!nt) return;
      Object.keys(rev).forEach(function (k) {
        if (k.indexOf(nt) !== -1 || nt.indexOf(k) !== -1) {
          (rev[k] || []).forEach(function (pid) {
            ids[pid] = true;
          });
        }
      });
    });
    return Object.keys(ids);
  }

  function assetMatchesSearchQuery(a, q) {
    if (!q) return true;
    /* Marketing ID (M-IMG249510) przed productCorrelation — inaczej 0 wynikow. */
    if (window.DamMarketingId && typeof window.DamMarketingId.format === "function") {
      var midNormEarly = normTag(window.DamMarketingId.format(a) || "");
      var qNormEarly = normTag(q);
      if (midNormEarly && qNormEarly && midNormEarly.indexOf(qNormEarly) !== -1) return true;
      if (
        typeof window.DamMarketingId.queryMatchesBrId === "function" &&
        window.DamMarketingId.queryMatchesBrId(q, a.id)
      ) {
        return true;
      }
      var qDigitsEarly = String(q).replace(/\D/g, "");
      if (qDigitsEarly.length >= 4) {
        var midDigitsEarly = midNormEarly.replace(/\D/g, "");
        var brDigitsEarly = String(a.id || "").replace(/\D/g, "");
        if (
          (midDigitsEarly && midDigitsEarly.indexOf(qDigitsEarly) !== -1) ||
          (brDigitsEarly && brDigitsEarly.indexOf(qDigitsEarly) !== -1)
        ) {
          return true;
        }
      }
    }
    if (productCorrelation && window.DamProductCorrelation) {
      if (productCorrelation.productId) {
        return DamProductCorrelation.brandingAssetMatches(
          a,
          productCorrelation.productId,
          productCorrelation.tokens
        );
      }
      if (productCorrelation.tokens && productCorrelation.tokens.length) {
        return DamProductCorrelation.brandingAssetMatches(a, "", productCorrelation.tokens);
      }
    }
    var tokenGroups = searchTokenGroups(q);
    if (!tokenGroups.length) return true;
    var tokens = searchTokens(q);
    var blob = assetBlobNorm(a);
    var assocPids = associationProductIdsForTokens(tokens);
    if (assocPids.length && (a.linked_product_ids || []).some(function (pid) { return assocPids.indexOf(pid) !== -1; })) {
      return true;
    }
    if (window.DamProductCorrelation && /^[\d.\s]+$/.test(String(q).replace(/\s/g, ""))) {
      var idxIds = DamProductCorrelation.resolveProductIdsFromQuery(q);
      if (idxIds.length && (a.linked_product_ids || []).some(function (pid) { return idxIds.indexOf(pid) !== -1; })) {
        return true;
      }
      if (DamProductCorrelation.brandingAssetMatches(a, idxIds[0] || "", DamProductCorrelation.productIndexTokens(q))) {
        return true;
      }
    }
    var byTag = (searchIndex && searchIndex.by_tag) || {};
    tokens.forEach(function (t) {
      var nt = normTag(t);
      Object.keys(byTag).forEach(function (tag) {
        if (normTag(tag).indexOf(nt) !== -1 && (byTag[tag] || []).indexOf(a.id) !== -1) {
          blob += " " + normTag(tag);
        }
      });
    });
    return tokenGroups.every(function (group) {
      return group.some(function (t) {
        return blob.indexOf(t) !== -1;
      });
    });
  }

  function filterByWhen(a, whenId) {
    if (!whenId) return true;
    var blob = assetBlobNorm(a);
    if (/^20\d{2}$/.test(whenId)) {
      return blob.indexOf(whenId) !== -1 || extractYearFromAsset(a) === whenId;
    }
    if (whenId === "grill") {
      return /grill|burger|parowk|kaszank|listonic|niemies|roslinn|wakacj|lato/.test(blob);
    }
    if (whenId === "święta") {
      return /swiet|adwent|boze|narodzen|gwiazd/.test(blob);
    }
    if (whenId === "wielkanoc") {
      return /wielkanoc|jajk|pasch/.test(blob);
    }
    if (whenId === "jesien") {
      return /jesien|jesień|autumn|back\s*to\s*school|szkol/.test(blob);
    }
    if (whenId === "zima") {
      return /zim|zima|mróz|mroz|snieg|śnieg/.test(blob);
    }
    if (whenId === "walentynki") {
      return /walentyn|valentine|14\s*02/.test(blob);
    }
    if (whenId === "dzienmatki") {
      return /dzien\s*matk|mother\s*day|matki/.test(blob);
    }
    if (whenId === "backtoschool") {
      return /back\s*to\s*school|szkol|wrzesn|wrześn/.test(blob);
    }
    if (whenId === "blackfriday") {
      return /black\s*friday|blackfriday|bf\s*20/.test(blob);
    }
    if (whenId === "q1") {
      return /\bq1\b|q1[\s_-]|01\.|02\.|03\./.test(blob);
    }
    if (whenId === "q2") {
      return /\bq2\b|q2[\s_-]|04\.|05\.|06\./.test(blob);
    }
    if (whenId === "q3") {
      return /\bq3\b|q3[\s_-]|07\.|08\.|09\./.test(blob);
    }
    if (whenId === "q4") {
      return /\bq4\b|q4[\s_-]|10\.|11\.|12\./.test(blob);
    }
    return true;
  }

  function findAssetById(id) {
    if (!index || !index.assets) return null;
    for (var i = 0; i < index.assets.length; i++) {
      if (index.assets[i].id === id) return index.assets[i];
    }
    return null;
  }

  function trackRecentAsset(a) {
    if (!a || !a.id) return;
    var list = [];
    try {
      list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    } catch (eRec) {
      list = [];
    }
    list = list.filter(function (id) {
      return id !== a.id;
    });
    list.unshift(a.id);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 10)));
  }

  function readRecentAssets() {
    var list = [];
    try {
      list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    } catch (eRead) {
      list = [];
    }
    return list.map(findAssetById).filter(Boolean);
  }

  function findThumbForTile(tile) {
    var assets = index && index.assets ? index.assets : [];
    for (var i = 0; i < assets.length; i++) {
      var a = assets[i];
      if (!a.perspective) continue;
      var blob = assetBlobNorm(a);
      if (tile.appearance && blob.indexOf(normTag(tile.appearance)) === -1) continue;
      if (tile.search && blob.indexOf(normTag(tile.search)) === -1) continue;
      return a;
    }
    return null;
  }

  function setSearchQuery(q) {
    var search = document.getElementById("damBrandingSearch");
    if (search) search.value = q || "";
  }

  function applyQuickSearch(q) {
    setSearchQuery(q);
    discoveryWhen = "";
    renderTagFilters();
    renderActiveSection();
  }

  function applyCollection(col) {
    if (!col) return;
    setSearchQuery(col.search || "");
    discoveryWhen = col.when || "";
    if (col.tab) activateTab(col.tab, { skipHash: true, keepDiscovery: true });
    if (col.facet) {
      activeTagFilters = {};
      activeTagFilters[facetKey(col.facet)] = true;
    } else if (col.appearance) {
      activeTagFilters = {};
      activeTagFilters[appearanceKey(col.appearance)] = true;
    } else if (col.media) {
      activeTagFilters = {};
      activeTagFilters["media:" + col.media] = true;
    }
    renderTagFilters();
    renderActiveSection();
  }

  function renderContextBar(displayCount) {
    var bar = document.getElementById("damBrandingContextBar");
    var chipsHost = document.getElementById("damBrandingContextChips");
    if (!bar) return;
    var active = hasActiveDiscoveryFilters();
    bar.hidden = !active;
    if (!active || !chipsHost) return;

    var chips = [];
    var q = elVal("damBrandingSearch");
    if (q) {
      chips.push({ kind: "search", label: "Szukaj: „" + q + "”", remove: function () {
        setSearchQuery("");
        renderTagFilters();
        renderActiveSection();
      }});
    }
    if (discoveryWhen) {
      var whenLbl = (WHEN_CHIPS.filter(function (w) { return w.id === discoveryWhen; })[0] || {}).label || discoveryWhen;
      chips.push({ kind: "when", label: "Kiedy: " + whenLbl, remove: function () {
        discoveryWhen = "";
        renderTagFilters();
        renderActiveSection();
      }});
    }
    Object.keys(activeTagFilters).forEach(function (key) {
      if (!activeTagFilters[key]) return;
      var label = key.split(":").slice(1).join(":");
      chips.push({ kind: "tag", key: key, label: label, remove: function () {
        delete activeTagFilters[key];
        renderTagFilters();
        renderActiveSection();
      }});
    });

    chipsHost.innerHTML = chips
      .map(function (chip, idx) {
        return (
          '<span class="dam-branding-context-chip">' +
          esc(chip.label) +
          '<button type="button" class="dam-branding-context-chip__remove" data-ctx-idx="' +
          idx +
          '" aria-label="Usuń filtr ' +
          esc(chip.label) +
          '">×</button></span>'
        );
      })
      .join("");

    var countEl = bar.querySelector(".dam-branding-context__count");
    if (typeof displayCount === "number") {
      if (!countEl) {
        countEl = document.createElement("span");
        countEl.className = "dam-branding-context__count";
        countEl.setAttribute("aria-live", "polite");
        bar.appendChild(countEl);
      }
      countEl.textContent =
        displayCount === 0
          ? "Brak elementów do wyświetlenia"
          : "Pokazano " + displayCount + (displayCount === 1 ? " element" : " elementów");
    } else if (countEl) {
      countEl.remove();
    }

    chipsHost.querySelectorAll("[data-ctx-idx]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = parseInt(btn.getAttribute("data-ctx-idx"), 10);
        if (chips[idx] && typeof chips[idx].remove === "function") chips[idx].remove();
      });
    });
  }

  /* Discovery / "Ostatnio otwierane" panel removed from DOM (empty padded
     host when localStorage recent was empty = ~30px spacer). Keep no-op. */
  function renderDiscoveryPanel() {
    return;
  }

  function assocChipLabel(term) {
    return String(term || "")
      .split(/\s+/)
      .map(function (w) {
        return w.charAt(0).toUpperCase() + w.slice(1);
      })
      .join(" ");
  }

  function buildDiscoveryFilterGroups() {
    return {
      skojarzenia: QUICK_ASSOCIATIONS.filter(function (term) {
        return !isCanonicalCovered("skojarzenia", term);
      }).map(function (term) {
        return { key: "search:" + normTag(term), label: assocChipLabel(term) };
      }),
      kiedy: WHEN_CHIPS.map(function (w) {
        return { key: "when:" + w.id, label: w.label };
      }),
      kolekcje: CURATED_COLLECTIONS.map(function (c) {
        return { key: "collection:" + c.id, label: c.label };
      }),
      co: WHAT_TILES.filter(function (tile) {
        return !isCanonicalCovered("co", tile.label);
      }).map(function (tile) {
        var tq = normTag(tile.search || tile.appearance || tile.label);
        return { key: "co:" + tq, label: tile.label };
      }),
    };
  }

  function buildAssocActiveMap() {
    var map = Object.assign({}, activeTagFilters);
    if (discoveryWhen) map["when:" + discoveryWhen] = true;
    var q = normTag(elVal("damBrandingSearch"));
    if (q) {
      QUICK_ASSOCIATIONS.forEach(function (term) {
        if (normTag(term) === q) map["search:" + normTag(term)] = true;
      });
      WHAT_TILES.forEach(function (tile) {
        var tq = normTag(tile.search || tile.appearance || tile.label);
        if (tq === q) map["co:" + tq] = true;
      });
      CANONICAL_TAGS.forEach(function (c) {
        if (c.groups.indexOf("skojarzenia") < 0) return;
        if (normTag(c.label) === q || normTag(String(c.id).replace(/_/g, " ")) === q) {
          map[facetKey(c.id)] = true;
        }
      });
    }
    return map;
  }

  function handleAssocChipClick(key) {
    if (key.indexOf("search:") === 0) {
      var term = key.slice(7);
      if (normTag(elVal("damBrandingSearch")) === term) applyQuickSearch("");
      else applyQuickSearch(term);
      return;
    }
    if (key.indexOf("when:") === 0) {
      var whenId = key.slice(5);
      discoveryWhen = discoveryWhen === whenId ? "" : whenId;
      renderTagFilters();
      renderActiveSection();
      return;
    }
    if (key.indexOf("collection:") === 0) {
      var colId = key.slice(11);
      var col = CURATED_COLLECTIONS.filter(function (c) {
        return c.id === colId;
      })[0];
      applyCollection(col);
      return;
    }
    if (key.indexOf("co:") === 0) {
      var coKey = key.slice(3);
      var tile = WHAT_TILES.filter(function (t) {
        return normTag(t.search || t.appearance || t.label) === coKey;
      })[0];
      if (tile && tile.appearance) {
        activeTagFilters = {};
        activeTagFilters[appearanceKey(tile.appearance)] = true;
        setSearchQuery("");
        discoveryWhen = "";
        renderTagFilters();
        renderActiveSection();
      } else {
        applyQuickSearch(coKey);
      }
    }
  }

  function assetsForSectionTab(tab) {
    var corrActive = productCorrelation && productCorrelation.productId;
    var all = filteredAssets({
      keyVisuale: tab === "packshots" && !corrActive,
      brandbookOnly: tab === "brandbook" && !corrActive,
    });
    if (corrActive) return all;
    if (tab === "all") return all;
    return all.filter(function (a) {
      return assetInSectionTab(a, tab);
    });
  }

  function filterByDiscovery(list) {
    list = asAssetList(list);
    if (!discoveryWhen) return list;
    return list.filter(function (a) {
      return filterByWhen(a, discoveryWhen);
    });
  }

  function currentSectionTab() {
    var btn = document.querySelector(".dam-branding-tab.is-active");
    return (btn && btn.getAttribute("data-tab")) || "all";
  }

  function isCatHintDismissed() {
    try {
      return sessionStorage.getItem(CAT_HINT_DISMISS_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function setCatHintDismissed() {
    try {
      sessionStorage.setItem(CAT_HINT_DISMISS_KEY, "1");
    } catch (e) {
      /* ignore */
    }
  }

  function hideCategoryHint() {
    var el = document.getElementById("damBrandingCategoryHint");
    if (el) el.hidden = true;
  }

  function showCategoryHint() {
    var el = document.getElementById("damBrandingCategoryHint");
    if (!el || isCatHintDismissed()) return;
    var tab = currentSectionTab();
    if (!tab || tab === "all" || tab === "brandbook") {
      hideCategoryHint();
      return;
    }
    el.hidden = false;
    el.classList.add("is-enter");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.classList.remove("is-enter");
      });
    });
  }

  function bindCategoryHintUi() {
    if (catHintBound) return;
    catHintBound = true;
    var closeBtn = document.getElementById("damBrandingCategoryHintClose");
    var ctaBtn = document.getElementById("damBrandingCategoryHintAll");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        setCatHintDismissed();
        hideCategoryHint();
      });
    }
    if (ctaBtn) {
      ctaBtn.addEventListener("click", function () {
        setCatHintDismissed();
        hideCategoryHint();
        activateTab("all");
      });
    }
  }

  function ensureListEndObserver() {
    var sentinel = document.getElementById("damBrandingListEnd");
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    if (catHintObserver) {
      catHintObserver.disconnect();
      catHintObserver = null;
    }
    catHintObserver = new IntersectionObserver(
      function (entries) {
        var hit = entries.some(function (en) {
          return en.isIntersecting && en.intersectionRatio > 0;
        });
        if (!hit) return;
        showCategoryHint();
      },
      { root: null, rootMargin: "0px 0px 40px 0px", threshold: 0 }
    );
    catHintObserver.observe(sentinel);
  }

  function syncCategoryHintForTab(tab) {
    if (!tab || tab === "all" || tab === "brandbook") {
      hideCategoryHint();
      return;
    }
    ensureListEndObserver();
  }

  function renderActiveSection() {
    try {
      var tab = currentSectionTab();
    var sectionPanel = document.getElementById("damBrandingPanelSection");
    var brandbookPanel = document.getElementById("damBrandingPanelBrandbook");
    if (sectionPanel) sectionPanel.hidden = tab === "brandbook";
    if (brandbookPanel) brandbookPanel.hidden = tab !== "brandbook";

    if (tab === "brandbook") {
      updateGridCount([], [], GRID_LIMIT_TAB, {});
      hideCategoryHint();
      renderBrandbook();
      return;
    }

    var descEl = document.getElementById("damBrandingSectionDesc");
    if (descEl) descEl.textContent = SECTION_DESCS[tab] || "";

    var sectionAll = assetsForSectionTab(tab);
    renderDiscoveryPanel(tab);
    var list = filterByDiscovery(sectionAll);
    renderContextBar(list.length);

    var gridOpts = { groupMode: tab === "packshots" ? "keyvisuale" : "project" };
    var grid = document.getElementById("damBrandingSectionGrid");
    var emptyMsg = elVal("damBrandingSearch")
      ? "Brak wyników dla tego wyszukiwania — spróbuj innego skojarzenia (burger, grill, proteina)."
      : "Brak materiałów — zmień filtr „Kiedy”, tag u góry albo wpisz słowo kluczowe.";
    var shown = renderAssetGrid(grid, list, GRID_LIMIT_TAB, emptyMsg, sectionAll.length, gridOpts);
    setStatusEl(document.getElementById("damBrandingStatus"), shown, list.length, GRID_LIMIT_TAB);
    updateGridCount(shown, list, GRID_LIMIT_TAB, gridOpts, lastGroupedTotal);
    syncCategoryHintForTab(tab);
    } catch (eRender) {
      console.error("[DamBranding] renderActiveSection", eRender);
      var errGrid = document.getElementById("damBrandingSectionGrid");
      if (errGrid) {
        errGrid.innerHTML =
          '<div class="dam-branding-empty" role="alert"><h3 class="dam-branding-empty__title">Błąd wyświetlania</h3><p class="dam-branding-empty__desc">' +
          esc(eRender.message || String(eRender)) +
          "</p></div>";
      }
    }
  }

  function groupDisplayLabel(assets) {
    var key = logoGroupKey(assets[0]);
    if (key === "logo:kubara") return "KUBARA — logo";
    if (key === "logo:dk") return "Dobra Kaloria — logo";
    if (key === "logo:gc") return "Good Calories — logo";
    var name = String(assets[0].name || "Logo")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/\s*-\s*\d+.*$/i, "")
      .trim();
    if (/\blogo\b/i.test(name)) {
      return name.replace(/\s+/g, " ").trim();
    }
    return name + " — logo";
  }

  function groupBrandingAssets(list, opts) {
    opts = opts || {};
    list = asAssetList(list);
    if (opts.groupMode === "keyvisuale") return groupKeyVisualAssets(list);
    if (opts.groupMode === "project") return groupMarketingAssets(list);
    var byKey = {};
    var order = [];
    list.forEach(function (a) {
      var key = logoGroupKey(a);
      if (!key) {
        order.push({ type: "single", id: a.id });
        return;
      }
      if (!byKey[key]) {
        byKey[key] = [];
        order.push({ type: "group", key: key });
      }
      byKey[key].push(a);
    });
    var out = [];
    var seen = {};
    order.forEach(function (item) {
      if (item.type === "single") {
        var one = list.find(function (x) {
          return x.id === item.id;
        });
        if (one) out.push({ type: "single", assets: [one] });
        return;
      }
      if (seen[item.key]) return;
      seen[item.key] = true;
      var bucket = byKey[item.key] || [];
      if (bucket.length < 2) {
        bucket.forEach(function (a) {
          out.push({ type: "single", assets: [a] });
        });
        return;
      }
      var sorted = bucket.slice().sort(function (a, b) {
        return String(a.name || "").localeCompare(String(b.name || ""), "pl");
      });
      out.push({
        type: "group",
        assets: sorted,
        primary: pickPrimaryAsset(sorted),
        label: groupDisplayLabel(sorted),
      });
    });
    return out;
  }

  function clearTagFilters() {
    activeTagFilters = {};
    renderTagFilters();
  }

  function isProductChipLabel(label) {
    var k = normTag(label);
    if (!k || k.length < 3 || k.length > 28) return false;
    if (/[/:\\.]/.test(label)) return false;
    if (/^(www|meta|dk|gc|raster|vector|document|video|source|front|enface|back|xl|l|s|jpg|png|tif|tiff|psd|psb)$/.test(k)) {
      return false;
    }
    var banned = [
      "marketing",
      "polska",
      "strony",
      "strona",
      "branding",
      "kaloria",
      "dobra",
      "wizki",
      "internet",
      "e-commerce",
      "ecommerce",
      "folder",
      "archiwum",
    ];
    for (var i = 0; i < banned.length; i++) {
      if (k === banned[i]) return false;
    }
    if (!/^[a-ząćęłńóśźż]/i.test(String(label).trim())) return false;
    if (String(label).indexOf(":/") !== -1) return false;
    return true;
  }

  function productChipsFromIndex() {
    var base = PRODUCT_TAG_CHIPS.filter(function (l) {
      return !isCanonicalCovered("produkt", l);
    });
    var seen = {};
    base.forEach(function (l) {
      seen[normTag(l)] = true;
    });
    CANONICAL_TAGS.forEach(function (c) {
      if (c.groups.indexOf("produkt") >= 0) seen[normTag(c.label)] = true;
    });
    var byTag = (searchIndex && (searchIndex.by_appearance || searchIndex.by_tag)) || {};
    var ranked = Object.keys(byTag)
      .map(function (label) {
        return { label: label, n: (byTag[label] || []).length };
      })
      .filter(function (row) {
        if (row.n < 6) return false;
        if (!isProductChipLabel(row.label)) return false;
        if (isCanonicalCovered("produkt", row.label)) return false;
        var k = normTag(row.label);
        if (seen[k]) return false;
        return true;
      })
      .sort(function (a, b) {
        return b.n - a.n;
      })
      .slice(0, 12);
    ranked.forEach(function (row) {
      base.push(row.label);
      seen[normTag(row.label)] = true;
    });
    return base;
  }

  var TAG_FILTER_ROW_LIMIT = 8;
  var TAG_FILTER_MAX_VISIBLE_ROWS = 4;
  var tagFilterExpanded = {};
  var tagFilterShowMore = false;

  function renderTagFilters() {
    var host = document.getElementById("damBrandingTagFilters");
    if (!host) return;
    var chips = FACET_CHIPS.slice().concat(assetRoleChipsFromIndex());
    productChipsFromIndex().forEach(function (label) {
      chips.push({ key: appearanceKey(label), label: label, group: "produkt" });
    });
    var groups = buildDiscoveryFilterGroups();
    groups.format_pliku = [];
    groups.przeznaczenie = [];
    groups.cechy = [];
    groups.wizualizacja = [];
    groups.kanal = [];
    groups.marka = [];
    groups.autor = [];
    groups.produkt = [];
    chips.forEach(function (c) {
      var g = c.group || "produkt";
      if (!groups[g]) groups[g] = [];
      groups[g].push(c);
    });
    [
      "marka",
      "autor",
      "skojarzenia",
      "przeznaczenie",
      "format_pliku",
      "kanal",
      "produkt",
      "cechy",
      "wizualizacja",
      "kiedy",
      "kolekcje",
      "co",
    ].forEach(function (g) {
      if (!groups[g]) groups[g] = [];
      groups[g] = dedupeChipsByKey(canonicalChipsForGroup(g).concat(groups[g]));
    });
    var GROUP_ORDER = [
      "marka",
      "autor",
      "skojarzenia",
      "przeznaczenie",
      "format_pliku",
      "kanal",
      "produkt",
      "cechy",
      "wizualizacja",
      "kiedy",
      "kolekcje",
      "co",
    ];
    var allChipKeys = [];
    var seenChipKeys = {};
    GROUP_ORDER.forEach(function (g) {
      (groups[g] || []).forEach(function (c) {
        if (!c.key || seenChipKeys[c.key]) return;
        seenChipKeys[c.key] = true;
        allChipKeys.push(c.key);
      });
    });
    var sectionTab = currentSectionTab();
    var countPair = computeFacetCountsPair(allChipKeys, sectionTab);
    var facetCounts = countPair.facet;
    var globalFacetCounts = countPair.global;
    var facetElCounts = countPair.facetEls || {};
    var showCounts = showTagCounts();
    var activeMap = buildAssocActiveMap();
    var buildRow = window.DamTagBar && DamTagBar.buildGroupRow;
    var html = '<div class="dam-tag-groups__inner">';
    var rowCount = 0;
    GROUP_ORDER.forEach(function (g) {
      if (!groups[g] || !groups[g].length || !buildRow) return;
      if (!tagFilterShowMore && rowCount >= TAG_FILTER_MAX_VISIBLE_ROWS) return;
      rowCount++;
      var rowClass =
        "dam-branding-tag-group--" +
        g +
        (g === "przeznaczenie" ? " dam-branding-tag-group--przeznaczenie-tiles" : "");
      html += buildRow({
        groupKey: g,
        label: FILTER_GROUP_LABELS[g] || g,
        className: rowClass,
        chips: groups[g].map(function (c) {
          var cnt = facetCounts[c.key] || 0;
          var globalCnt = globalFacetCounts[c.key] || 0;
          return {
            key: c.key,
            label: c.label,
            count: cnt,
            empty: globalCnt === 0,
          };
        }),
        activeMap: activeMap,
        expandedGroups: tagFilterExpanded,
        rowLimit: TAG_FILTER_ROW_LIMIT,
        pillHtml: function (chip, active) {
          var badgeCls = FILTER_BADGE_CLASS[g] || "dam-viz-badge--subcat";
          var cnt = typeof chip.count === "number" ? chip.count : facetCounts[chip.key] || 0;
          var globalCnt = globalFacetCounts[chip.key] || 0;
          /* Najpierw elementy (karty/grupy), potem pliki */
          var elsCnt = facetElCounts[chip.key] || 0;
          var countHtml = showCounts
            ? ' <span class="dam-tag-count" aria-hidden="true">(' +
              elsCnt +
              " el. • " +
              cnt +
              " pl.)</span>"
            : "";
          return (
            '<button type="button" class="dam-viz-badge dam-badge-tag ' +
            badgeCls +
            (active ? " is-active" : "") +
            (globalCnt === 0 ? " is-empty-count" : "") +
            (showCounts ? " has-tag-count" : "") +
            '" data-tag-key="' +
            esc(chip.key) +
            '" aria-pressed="' +
            (active ? "true" : "false") +
            '"' +
            (globalCnt === 0 ? " disabled" : "") +
            ">" +
            esc(chip.label) +
            countHtml +
            "</button>"
          );
        },
      });
    });
    var totalRows = GROUP_ORDER.filter(function (g) {
      return groups[g] && groups[g].length;
    }).length;
    var hiddenRows = tagFilterShowMore ? 0 : Math.max(0, totalRows - TAG_FILTER_MAX_VISIBLE_ROWS);
    if (hiddenRows > 0 || tagFilterShowMore) {
      html +=
        '<div class="dam-branding-tag-filters__more-row">' +
        '<button type="button" class="dam-tag-more" data-branding-tag-more aria-expanded="' +
        (tagFilterShowMore ? "true" : "false") +
        '" title="' +
        (tagFilterShowMore ? "Zwiń listę filtrów tagów" : "Pokaż więcej grup filtrów") +
        '">' +
        (tagFilterShowMore ? "Zwiń" : "Pokaż więcej (+" + hiddenRows + ")") +
        "</button></div>";
    }
    html += "</div>";
    host.innerHTML = html;
    host.className = "dam-tag-groups dam-branding-tag-filters";

    host.querySelectorAll("[data-expand-group]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var g = btn.getAttribute("data-expand-group");
        if (!g) return;
        tagFilterExpanded[g] = !tagFilterExpanded[g];
        renderTagFilters();
      });
    });
    var moreBtn = host.querySelector("[data-branding-tag-more]");
    if (moreBtn) {
      moreBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        tagFilterShowMore = !tagFilterShowMore;
        renderTagFilters();
      });
    }

    host.querySelectorAll(".dam-viz-badge[data-tag-key]").forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        var key = btn.getAttribute("data-tag-key") || "";
        if (!key) return;
        if (/^(search:|when:|collection:|co:)/.test(key)) {
          handleAssocChipClick(key);
          return;
        }
        var multi = !!(ev && (ev.ctrlKey || ev.metaKey));
        var wasActive = !!activeTagFilters[key];
        var tabSwitch = "";
        if (multi) {
          /* CTRL/Cmd+klik: dodaj/odejmij z wyboru multi */
          if (wasActive) delete activeTagFilters[key];
          else activeTagFilters[key] = true;
        } else {
          /* Zwykly klik: ZASTAP caly wybor tym tagiem; drugi klik = wyczysc */
          var others = Object.keys(activeTagFilters).filter(function (k) {
            return k !== key && activeTagFilters[k];
          });
          Object.keys(activeTagFilters).forEach(function (k) {
            delete activeTagFilters[k];
          });
          if (!(wasActive && !others.length)) activeTagFilters[key] = true;
        }
        if (activeTagFilters[key] && !wasActive) {
          /* Na "Pokaz wszystko" nie zawężaj sekcji - inaczej ARCHIWUM/META znika */
          if (currentSectionTab() !== "all") {
            tabSwitch = tabForFacetKey(key);
            if (!tabSwitch && (computeFacetCounts([key], currentSectionTab())[key] || 0) === 0) {
              tabSwitch = bestTabForTagKey(key);
            }
          }
          if (key.indexOf("facet:") === 0) setSearchQuery("");
        }
        clearBrandingComputeCache();
        if (tabSwitch) {
          var nextTab = normalizeTab(tabSwitch);
          document.querySelectorAll(".dam-branding-tab").forEach(function (b) {
            var on = b.getAttribute("data-tab") === nextTab;
            b.classList.toggle("is-active", on);
            b.setAttribute("aria-selected", on ? "true" : "false");
          });
        }
        if (window.DamLoader) window.DamLoader.start("Skojarzenia…");
        scheduleBrandingRender({ tags: true, section: true, loader: true });
      });
    });
  }

  window.__damBrandingThumbFallback = function (img) {
    if (!img) return;
    function replaceWithReadablePlaceholder() {
      img.onerror = null;
      var card = img.closest(".dam-branding-card, .dam-viz-card");
      var chip = card && card.querySelector(".dam-branding-card__id-chip, .dam-branding-id-chip");
      var titleEl = card && card.querySelector(".dam-viz-card__title");
      var idText =
        (chip && (chip.getAttribute("data-copy-id") || chip.getAttribute("data-tag-value") || chip.textContent || "").trim()) ||
        "";
      var nameText = (titleEl && (titleEl.textContent || "").trim()) || "";
      var path = img.getAttribute("data-path") || "";
      var base = path ? path.split(/[/\\]/).pop() : "";
      var label = idText || nameText || base || "plik";
      var wrap = document.createElement("div");
      wrap.className = "dam-viz-thumb__noviz dam-branding-thumb__icon dam-branding-thumb__icon--nosync";
      wrap.setAttribute("role", "img");
      wrap.setAttribute("aria-label", "Podglad niedostępny: " + label);
      wrap.title =
        (window.DamPreviewTruth && DamPreviewTruth.onErrorTitle()) ||
        "Podglad niedostępny";
      wrap.innerHTML =
        '<i class="uil uil-cloud-slash" aria-hidden="true"></i>' +
        "<span>Podglad niedostępny</span>" +
        (label
          ? '<span class="dam-branding-thumb__nosync-id">' +
            String(label)
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;") +
            "</span>"
          : "");
      if (img.parentNode) img.replaceWith(wrap);
    }
    if (img.dataset.fallbackTried === "1") {
      replaceWithReadablePlaceholder();
      return;
    }
    img.dataset.fallbackTried = "1";
    var path = img.getAttribute("data-path");
    if (path) {
      var name = path.split(/[/\\]/).pop();
      var ext = (name.split(".").pop() || "").toLowerCase();
      var mt = /^(psd|psb|tif|tiff|bmp)$/i.test(ext) ? "source" : "raster";
      img.src = mediaUrl(path, { path: path, name: name, media_type: mt });
      return;
    }
    replaceWithReadablePlaceholder();
  };

  function bindVideoPosterFallback(vid, bridgePoster) {
    if (!vid) return;
    var wanted = bridgePoster || "";
    vid.poster = VIDEO_POSTER_FALLBACK;
    if (!wanted) return;
    var probe = new Image();
    probe.onload = function () {
      try {
        vid.poster = wanted;
      } catch (e) {
        /* ignore */
      }
    };
    probe.onerror = function () {
      try {
        vid.poster = VIDEO_POSTER_FALLBACK;
      } catch (e2) {
        /* ignore */
      }
    };
    probe.src = wanted;
  }

  function hydrateVideoPosters(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll(".dam-branding-thumb__video-wrap").forEach(function (wrap) {
      var vid = wrap.querySelector("video.dam-branding-thumb__video-el");
      var poster = wrap.getAttribute("data-poster") || "";
      if (vid) bindVideoPosterFallback(vid, poster);
    });
  }

  window.__damBrandingBindVideoPoster = bindVideoPosterFallback;

  window.__damBrandingVideoThumbFallback = function (vid) {
    if (!vid) return;
    var wrap = vid.closest(".dam-branding-thumb__video-wrap");
    if (!wrap) return;
    var tried = Number(wrap.dataset.streamTry || "0");
    var path = wrap.getAttribute("data-path") || vid.getAttribute("data-path") || "";
    if (tried < 1 && path) {
      wrap.dataset.streamTry = "1";
      vid.poster = VIDEO_POSTER_FALLBACK;
      vid.src = rawMediaUrl(path) + "&_retry=1";
      vid.load();
      return;
    }
    if (wrap.dataset.fallbackDone === "1") return;
    wrap.dataset.fallbackDone = "1";
    wrap.innerHTML =
      '<div class="dam-viz-thumb__noviz dam-branding-thumb__icon">' +
      '<i class="uil uil-play-circle" aria-hidden="true"></i><span>Wideo</span></div>';
  };

  function recentThumbHtml(a) {
    if (!a) return "";
    var mt = normalizeMediaType(a.media_type);
    var name = a.name || "";
    if (mt === "video" || /\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(name)) {
      return (
        '<div class="dam-branding-recent__thumb-wrap">' +
        '<div class="dam-viz-thumb__noviz dam-branding-thumb__icon">' +
        '<i class="uil uil-play-circle" aria-hidden="true"></i><span>Wideo</span></div></div>'
      );
    }
    if (mt === "vector" || /\.(ai|eps|svg)$/i.test(name)) {
      return (
        '<div class="dam-branding-recent__thumb-wrap">' +
        '<div class="dam-viz-thumb__noviz dam-branding-thumb__icon">' +
        '<i class="uil uil-vector-square" aria-hidden="true"></i><span>Wektor</span></div></div>'
      );
    }
    if (/\.(png|jpe?g|webp|gif|tiff?|psd|psb|bmp)$/i.test(name) || mt === "image" || mt === "source") {
      return (
        '<div class="dam-branding-recent__thumb-wrap"><img class="dam-viz-thumb__img" data-path="' +
        esc(a.path || "") +
        '" src="' +
        esc(mediaUrl(a.path, a)) +
        '" alt="" loading="lazy" onerror="window.__damBrandingRecentThumbFallback&&__damBrandingRecentThumbFallback(this)" /></div>'
      );
    }
    return (
      '<div class="dam-branding-recent__thumb-wrap">' +
      thumbHtml(a) +
      "</div>"
    );
  }

  window.__damBrandingRecentThumbFallback = function (img) {
    if (!img) return;
    var wrap = img.closest(".dam-branding-recent__thumb-wrap");
    if (!wrap) {
      img.classList.add("dam-viz-thumb__img--placeholder");
      img.onerror = null;
      return;
    }
    wrap.innerHTML =
      '<div class="dam-viz-thumb__noviz dam-branding-thumb__icon">' +
      '<i class="uil uil-image" aria-hidden="true"></i><span>Brak podgl.</span></div>';
  };

  function folderHint(path) {
    if (window.DamBadges && typeof window.DamBadges.buildBrandingBadgeItems === "function") {
      var items = window.DamBadges.buildBrandingBadgeItems({ path: path });
      var folder = items.filter(function (it) {
        return it.kind === "folder";
      })[0];
      if (folder) return folder.label;
    }
    return "";
  }

  async function loadIndex() {
    if (index && !index.partial) return index;
    if (
      window.__damBrandingGridIndex &&
      window.__damBrandingGridIndex.assets &&
      !window.__damBrandingGridIndex.partial
    ) {
      index = window.__damBrandingGridIndex;
      clearBrandingComputeCache();
      return index;
    }
    setBootStatus("Ładowanie siatki…");
    var headUrls = [
      "data/branding-grid-head.json?v=" + CB,
      bridgeUrl() + "/branding-grid-head?v=" + CB,
    ];
    var fullUrls = [
      "data/branding-grid-index.json?v=" + CB,
      bridgeUrl() + "/branding-grid-index?v=" + CB,
    ];
    var lastErr = null;

    function adopt(data, isPartial) {
      if (!data || !data.assets) return false;
      index = data;
      index.partial = !!isPartial || !!data.partial;
      try {
        window.__damBrandingGridIndex = index;
        window.__damBrandingIndex = index;
      } catch (eShare) {
        /* ignore */
      }
      clearBrandingComputeCache();
      return true;
    }

    /** Odrzuc head z PDF/DOC (stary bug: empty role) — inaczej podwójne ładowanie „firmowe” → branding. */
    function isUsableInstantHead(data) {
      var assets = (data && data.assets) || [];
      if (assets.length < 40) return false;
      var sample = assets.slice(0, 60);
      var graphic = 0;
      var docish = 0;
      for (var i = 0; i < sample.length; i++) {
        var a = sample[i];
        var mt = String((a && a.media_type) || "").toLowerCase();
        var nm = String((a && (a.name || a.path)) || "").toLowerCase();
        if (mt === "image" || mt === "raster" || mt === "vector") graphic++;
        else if (/\.(png|jpe?g|webp|gif|svg)$/.test(nm)) graphic++;
        if (mt === "document" || /\.(pdf|docx?|pptx?|xlsx?)$/.test(nm)) docish++;
      }
      if (docish > graphic * 0.55) return false;
      if (graphic < Math.min(20, sample.length * 0.35)) return false;
      return true;
    }

    // Instant: head first (small), then hydrate full slim in background.
    for (var h = 0; h < headUrls.length; h++) {
      try {
        var hr = await fetch(headUrls[h]);
        if (!hr.ok) {
          lastErr = new Error("http_" + hr.status);
          continue;
        }
        setBootStatus("Przygotowanie kart…");
        var head = await hr.json();
        if (!isUsableInstantHead(head)) {
          lastErr = new Error("head_not_graphic");
          continue;
        }
        if (adopt(head, true)) {
          scheduleFullGridHydrate(fullUrls);
          return index;
        }
      } catch (eHead) {
        lastErr = eHead;
      }
    }

    for (var u = 0; u < fullUrls.length; u++) {
      try {
        var r = await fetch(fullUrls[u]);
        if (!r.ok) {
          lastErr = new Error("http_" + r.status);
          continue;
        }
        setBootStatus("Przygotowanie kart…");
        var full = await r.json();
        if (adopt(full, false)) return index;
        lastErr = new Error("grid_index_invalid");
        index = null;
      } catch (eLoad) {
        lastErr = eLoad;
      }
    }
    setBootStatus("Brak branding-grid-index. Uruchom build-branding-grid-index.");
    throw lastErr || new Error("branding-grid-index");
  }

  function scheduleFullGridHydrate(fullUrls) {
    if (window.__damBrandingGridHydrateStarted) return;
    window.__damBrandingGridHydrateStarted = true;
    (async function () {
      for (var u = 0; u < fullUrls.length; u++) {
        try {
          var r = await fetch(fullUrls[u]);
          if (!r.ok) continue;
          var full = await r.json();
          if (!full || !full.assets) continue;
          full.partial = false;
          index = full;
          try {
            window.__damBrandingGridIndex = full;
            window.__damBrandingIndex = full;
          } catch (e2) {
            /* ignore */
          }
          clearBrandingComputeCache();
          try {
            performance.mark("dam-branding-full-ready");
          } catch (eMark) {
            /* ignore */
          }
          var tab =
            (document.querySelector(".dam-branding-tab.is-active") &&
              document
                .querySelector(".dam-branding-tab.is-active")
                .getAttribute("data-tab")) ||
            "all";
          activateTab(tab, { skipHash: true, keepDiscovery: true });
          setBootStatus("");
          return;
        } catch (eHyd) {
          /* try next */
        }
      }
    })();
  }

  async function fetchFullAsset(assetId) {
    var id = String(assetId || "");
    if (!id) return null;
    try {
      var r = await fetch(bridgeUrl() + "/branding/asset?id=" + encodeURIComponent(id));
      if (!r.ok) return null;
      var j = await r.json();
      return (j && j.asset) || null;
    } catch (e) {
      return null;
    }
  }

  async function loadTokens() {
    if (tokens) return tokens;
    var r = await fetch("data/brand-tokens.json?v=" + CB);
    tokens = r.ok ? await r.json() : { colors: [] };
    return tokens;
  }

  async function loadCampaigns() {
    if (campaigns) return campaigns;
    try {
      var r = await fetch("data/campaigns.json?v=" + CB);
      if (r.ok) {
        campaigns = await r.json();
        rebuildCampaignAssetMap();
        return campaigns;
      }
    } catch (eCamp) { /* fallback */ }
    campaigns = { campaigns: [] };
    rebuildCampaignAssetMap();
    return campaigns;
  }

  function rebuildCampaignAssetMap() {
    campaignAssetMap = {};
    ((campaigns && campaigns.campaigns) || []).forEach(function (c) {
      var bucket = {};
      (c.asset_ids || []).forEach(function (id) {
        bucket[id] = true;
      });
      campaignAssetMap[c.id] = bucket;
    });
  }

  function isArchived(a) {
    var tags = a.tags || [];
    if (tags.indexOf("ARCHIWUM") !== -1) return true;
    if (a.is_archive) return true;
    var p = String(a.path || "").toUpperCase();
    return p.indexOf("ARCHIWUM") !== -1;
  }

  function baseFilteredAssets(extra) {
    extra = extra || {};
    var q = elVal("damBrandingSearch").toLowerCase();
    var keyOnly = !!extra.keyVisuale;
    var skipTagKey = extra.skipTagKey || "";

    var list = ((index && index.assets) || []).filter(function (a) {
      if (!includeArchive() && isArchived(a)) return false;
      if (!assetMatchesDateRange(a)) return false;
      if (skipTagKey) {
        var keys = Object.keys(activeTagFilters).filter(function (k) {
          return k !== skipTagKey && activeTagFilters[k];
        });
        for (var i = 0; i < keys.length; i++) {
          if (!assetMatchesTagKey(a, keys[i])) return false;
        }
      } else if (!assetMatchesActiveTags(a)) {
        return false;
      }
      if (!passesGraphicsOnlyFilter(a)) {
        return false;
      }
      if (keyOnly && !a.perspective) return false;
      if (extra.campaignId) {
        if (!assetMatchesCampaign(a, extra.campaignId)) return false;
      }
      if (extra.channelKey) {
        if (!assetMatchesChannel(a, extra.channelKey)) return false;
      }
      if (extra.brandbookOnly) {
        var up = String(a.path || "").toUpperCase();
        if (up.indexOf("BRANDING") === -1 && up.indexOf("BRAND BOOK") === -1 && up.indexOf("BRANDBOOK") === -1) {
          return false;
        }
      }
      if (q) {
        if (!assetMatchesSearchQuery(a, q)) return false;
      }
      return true;
    });
    if (extra.forCounts) return list;
    return sortAssetsForDisplay(list, q);
  }

  /** Picker browse (pusty q) — lokalny indeks branding, bez pełnego API. */
  function buildPickerBrowseRows(opts) {
    opts = opts || {};
    var cap = Math.max(1, Math.min(parseInt(opts.cap, 10) || 80, 80));
    if (!index || !index.assets || !index.assets.length) return [];
    var filtered = index.assets.filter(function (a) {
      if (!a || !a.id) return false;
      if (!includeArchive() && isArchived(a)) return false;
      if (!passesGraphicsOnlyFilter(a)) return false;
      return true;
    });
    var sorted = sortAssetsForDisplay(filtered, "");
    return sorted.slice(0, cap);
  }

  function facetFilterSignature(sectionTab) {
    var activeKeys = Object.keys(activeTagFilters)
      .filter(function (k) {
        return !!activeTagFilters[k];
      })
      .sort();
    return [
      sectionTab || currentSectionTab() || "",
      activeKeys.join("|"),
      includeArchive() ? "1" : "0",
      elVal("damBrandingDateFrom"),
      elVal("damBrandingDateTo"),
      elVal("damBrandingSearch").toLowerCase(),
      graphicsOnlyActive() ? "1" : "0",
      index && index.built_at ? index.built_at : "",
      index && index.asset_count ? String(index.asset_count) : "0",
    ].join("\u0001");
  }

  function clearBrandingComputeCache() {
    facetCountCache = null;
  }

  function invalidateBrandingIndexCache() {
    index = null;
    searchIndex = null;
    campaigns = null;
    campaignAssetMap = {};
    try {
      window.__damBrandingIndex = null;
    } catch (eShare) {
      /* ignore */
    }
    clearBrandingComputeCache();
    try {
      window.dispatchEvent(new CustomEvent("dam-branding-index-stale"));
    } catch (eStale) {
      /* ignore */
    }
  }

  var lastSectionRenderMs = 0;
  var brandingLoaderPending = false;
  var lastGroupedTotal = 0;

  function finishBrandingLoader() {
    if (!brandingLoaderPending) return;
    brandingLoaderPending = false;
    if (window.DamLoader) window.DamLoader.done();
  }

  /**
   * Fazowany render: skeleton (klatka 1) -> siatka (klatka 2) -> tagi/facety
   * (klatka 3). Facet-counts to petla assets x chipy - najciezsza czesc; siatka
   * ma sie pojawic PRZED nia, zeby UI nie zamarzal na kilka sekund.
   */
  function scheduleBrandingRender(opts) {
    opts = opts || {};
    if (opts.loader) brandingLoaderPending = true;
    if (brandingRenderRaf) cancelAnimationFrame(brandingRenderRaf);
    var showSkel =
      brandingLoaderPending &&
      opts.section !== false &&
      (lastSectionRenderMs > 150 ||
        (!lastSectionRenderMs && index && index.assets && index.assets.length > 800));
    brandingRenderRaf = requestAnimationFrame(function () {
      brandingRenderRaf = 0;
      var runPhases = function () {
        var t0 = window.performance ? performance.now() : Date.now();
        if (opts.section !== false) renderActiveSection();
        lastSectionRenderMs = (window.performance ? performance.now() : Date.now()) - t0;
        if (opts.tags !== false) {
          requestAnimationFrame(function () {
            renderTagFilters();
            finishBrandingLoader();
          });
        } else {
          finishBrandingLoader();
        }
      };
      if (showSkel && window.DamGridReveal && typeof window.DamGridReveal.skeleton === "function") {
        var grid = document.getElementById("damBrandingSectionGrid");
        if (grid) {
          window.DamGridReveal.skeleton(grid, { variant: "cards", layout: "viz-grid", responsive: true });
        }
        /* daj przeglądarce klatke na wymalowanie skeletonow przed ciezkim renderem */
        requestAnimationFrame(function () {
          setTimeout(runPhases, 0);
        });
      } else {
        runPhases();
      }
    });
  }

  function computeFacetCountsPair(chipKeys, sectionTab) {
    var sig = facetFilterSignature(sectionTab);
    if (
      facetCountCache &&
      facetCountCache.sig === sig &&
      facetCountCache.keysLen === chipKeys.length
    ) {
      return {
        facet: facetCountCache.facet,
        global: facetCountCache.global,
        facetEls: facetCountCache.facetEls,
      };
    }
    var facet = {};
    var global = {};
    var facetEls = {};
    var facetElSets = {};
    var i;
    for (i = 0; i < chipKeys.length; i++) {
      facet[chipKeys[i]] = 0;
      global[chipKeys[i]] = 0;
      facetEls[chipKeys[i]] = 0;
    }
    if (!index || !index.assets || !chipKeys.length) {
      return { facet: facet, global: global, facetEls: facetEls };
    }
    var activeKeys = Object.keys(activeTagFilters).filter(function (k) {
      return !!activeTagFilters[k];
    });
    var q = elVal("damBrandingSearch").toLowerCase();
    var tab = sectionTab || currentSectionTab();
    var assets = index.assets;
    var ckLen = chipKeys.length;
    for (i = 0; i < assets.length; i++) {
      var a = assets[i];
      if (!includeArchive() && isArchived(a)) continue;
      if (!assetMatchesDateRange(a)) continue;
      var graphicsPass = passesGraphicsOnlyFilter(a);
      if (q && !assetMatchesSearchQuery(a, q)) continue;
      var inTab = !tab || tab === "all" || assetInSectionTab(a, tab);
      var matches = new Array(ckLen);
      var ki;
      for (ki = 0; ki < ckLen; ki++) {
        matches[ki] =
          (graphicsPass || chipCountIgnoresGraphicsOnly(chipKeys[ki])) &&
          assetMatchesTagKey(a, chipKeys[ki]);
      }
      if (inTab) {
        var groupKey = "";
        for (ki = 0; ki < ckLen; ki++) {
          if (!matches[ki]) continue;
          var key = chipKeys[ki];
          var ok = true;
          var j;
          for (j = 0; j < activeKeys.length; j++) {
            if (activeKeys[j] === key) continue;
            if (!assetMatchesTagKey(a, activeKeys[j])) {
              ok = false;
              break;
            }
          }
          if (ok) {
            facet[key] += 1;
            /* Elementy = odrebne grupy folderowe (karty) - liczone raz na asset */
            if (!groupKey) {
              groupKey = a.folder_group_id || marketingGroupKey(a);
            }
            var set = facetElSets[key] || (facetElSets[key] = {});
            if (!set[groupKey]) {
              set[groupKey] = 1;
              facetEls[key] += 1;
            }
          }
        }
      }
      for (ki = 0; ki < ckLen; ki++) {
        if (!matches[ki]) continue;
        var gkey = chipKeys[ki];
        var gok = true;
        var gj;
        for (gj = 0; gj < activeKeys.length; gj++) {
          if (activeKeys[gj] === gkey) continue;
          if (!assetMatchesTagKey(a, activeKeys[gj])) {
            gok = false;
            break;
          }
        }
        if (gok) global[gkey] += 1;
      }
    }
    facetCountCache = {
      sig: sig,
      keysLen: chipKeys.length,
      facet: facet,
      global: global,
      facetEls: facetEls,
    };
    return { facet: facet, global: global, facetEls: facetEls };
  }

  function computeFacetCounts(chipKeys, sectionTab, opts) {
    opts = opts || {};
    var pair = computeFacetCountsPair(chipKeys, sectionTab);
    return opts.global ? pair.global : pair.facet;
  }

  function bestTabForTagKey(key) {
    var tabs = ["packshots", "www", "campaigns", "social", "brandbook"];
    var best = "";
    var bestN = 0;
    tabs.forEach(function (tab) {
      var n = computeFacetCounts([key], tab)[key] || 0;
      if (n > bestN) {
        bestN = n;
        best = tab;
      }
    });
    return best;
  }

  /** Pick tab with most search hits for ?q= (avoids false "Brak wynikow" on default campaigns). */
  function bestTabForSearchQuery(q) {
    var tabs = ["packshots", "www", "campaigns", "social", "brandbook"];
    var best = "campaigns";
    var bestN = 0;
    var qLower = String(q || "").toLowerCase().trim();
    if (!qLower || !index || !index.assets) return best;
    tabs.forEach(function (tab) {
      var n = 0;
      var i;
      for (i = 0; i < index.assets.length; i++) {
        var a = index.assets[i];
        if (!includeArchive() && isArchived(a)) continue;
        if (!assetInSectionTab(a, tab)) continue;
        if (assetMatchesSearchQuery(a, qLower)) n++;
      }
      if (n > bestN) {
        bestN = n;
        best = tab;
      }
    });
    return best;
  }

  function filteredAssets(opts) {
    return baseFilteredAssets(opts || {});
  }

  function assetMatchesCampaign(a, campaignId) {
    if (!campaignId) return true;
    if (a.campaign_id === campaignId) return true;
    var bucket = campaignAssetMap[campaignId];
    if (bucket && bucket[a.id]) return true;
    var needle = String(campaignId).toLowerCase();
    var hay = ((a.path || "") + " " + (a.name || "") + " " + (a.search_blob || "")).toLowerCase();
    return hay.indexOf(needle) !== -1;
  }

  function assetMatchesChannel(a, channelKey) {
    if (!channelKey) return true;
    var key = String(channelKey).toLowerCase();
    var ch = (a.channels || []).map(function (c) {
      return String(c).toLowerCase();
    });
    if (ch.indexOf(key) !== -1) return true;
    var p = String(a.path || "").toUpperCase();
    if (key === "www" && SECTION_MARKERS.www.test(p)) return true;
    if (key === "meta" && SECTION_MARKERS.social.test(p)) return true;
    if (key === "instagram" && SECTION_MARKERS.social.test(p)) return true;
    if (key === "google" && (p.indexOf("GOOGLE") !== -1 || SECTION_MARKERS.campaigns.test(p))) return true;
    return (a.search_blob || "").toLowerCase().indexOf(key) !== -1;
  }

  function marketingDisplayId(asset) {
    if (window.DamMarketingId && typeof window.DamMarketingId.format === "function") {
      return window.DamMarketingId.format(asset);
    }
    return asset && asset.id ? asset.id : "";
  }

  function brandingCardSubtitle(a, title) {
    var tags = (a && a.appearance_tags) || [];
    var t = String(title || "").trim();
    tags.some(function (tag) {
      var k = normTag(tag);
      if (!k || k.length < 3) return false;
      if (t && t.toLowerCase().indexOf(k) >= 0) return false;
      return true;
    });
    var pick = tags.find(function (tag) {
      var k = normTag(tag);
      return k && k.length > 2 && (!t || t.toLowerCase().indexOf(k) < 0);
    });
    if (!pick) return "";
    return (
      '<br><span class="dam-viz-card__title-pl"><span class="dam-viz-card__title-pl-paren">( </span>' +
      '<span class="dam-viz-card__title-pl-text">' +
      esc(pick) +
      '</span><span class="dam-viz-card__title-pl-paren"> )</span></span>'
    );
  }

  function brandingCardTypeMeta(a) {
    if (!a) return "";
    if (a.media_type === "video") return "Wideo";
    if (/slider/i.test(a.asset_role || "") || /slider/i.test(a.name || "")) return "Slider";
    if (a.asset_role === "banner") return "Baner";
    if (a.asset_role === "key_visual") return "Key visual";
    if (/\.gif$/i.test(a.name || "")) return "GIF";
    if (a.media_type === "vector") return "Wektor";
    return "Obraz";
  }

  function brandingCardActionsHtml(a) {
    var path = (a && a.path) || "";
    return (
      '<div class="dam-viz-card__actions">' +
      '<button type="button" class="geex-btn geex-btn--primary dam-btn-icon dam-branding-preview-btn" data-id="' +
      esc(a.id) +
      '" title="Podgląd" data-dam-tip="Otwiera podgląd materiału">' +
      '<i class="uil uil-eye" aria-hidden="true"></i><span>Podgląd</span></button>' +
      '<button type="button" class="geex-btn dam-btn-icon dam-btn-icon-only dam-viz-win-explorer-btn dam-win-btn" data-path="' +
      esc(path) +
      '" aria-label="Folder Windows" title="Folder Windows" data-dam-tip="Otwiera folder w Eksploratorze plików Windows">' +
      (window.DamIcons && typeof window.DamIcons.winExplorerSvg === "function"
        ? window.DamIcons.winExplorerSvg()
        : '<i class="uil uil-folder" aria-hidden="true"></i>') +
      "</button>" +
      '<button type="button" class="geex-btn dam-btn-icon dam-btn-icon-only dam-branding-share-btn" data-path="' +
      esc(path) +
      '" aria-label="Udostępnij" title="Udostępnij" data-dam-tip="Udostępnij plik przez Synology Drive">' +
      '<i class="uil uil-share-alt" aria-hidden="true"></i></button>' +
      "</div>"
    );
  }

  function badgesHtml(a, extraTags) {
    if (!window.DamBadges || typeof window.DamBadges.renderBranding !== "function") {
      var base =
        '<span class="dam-viz-badge dam-viz-badge--brand">' +
        esc(a.brand || "DK") +
        "</span>";
      if (isLogoAsset(a)) {
        base += '<span class="dam-viz-badge dam-viz-badge--meta">Logo</span>';
      }
      return base;
    }
    var html = window.DamBadges.renderBranding(a, {
      includeTagTiers: ["primary", "low", "minimal"],
      maxPerKind: 5,
      maxTotal: 14,
    });
    /* ID marketingowe nie jest juz w badge'ach - siedzi jako kopiowalny chip
       przy tytule karty (brandingCardIdChipHtml). */
    if (extraTags && extraTags.length) {
      extraTags.forEach(function (tag) {
        html +=
          '<span class="dam-viz-badge dam-viz-badge--variants">' + esc(tag) + "</span>";
      });
    } else if (isLogoAsset(a) && html.indexOf(">Logo<") === -1 && html.indexOf(">LOGO<") === -1) {
      html += '<span class="dam-viz-badge dam-viz-badge--meta">Logo</span>';
    }
    return html;
  }

  function thumbStackHtml(assets, primary) {
    var p = primary || assets[0];
    var second = assets.find(function (a) {
      return a.id !== p.id && /\.(png|jpe?g|webp)$/i.test(a.name || "");
    });
    var html = '<div class="dam-branding-thumb-stack">';
    if (second) {
      html +=
        '<div class="dam-branding-thumb-stack__layer dam-branding-thumb-stack__layer--back">' +
        thumbHtml(second) +
        "</div>";
    }
    html +=
      '<div class="dam-branding-thumb-stack__layer dam-branding-thumb-stack__layer--front">' +
      thumbHtml(p) +
      "</div></div>";
    return html;
  }

  function thumbHtml(a) {
    if (a.media_type === "video") {
      var path = a.path || "";
      var poster =
        bridgeUrl() +
        "/media?path=" +
        encodeURIComponent(localMediaPath(path)) +
        "&preview=1";
      var stream = rawMediaUrl(path);
      /* B3: start with local SVG poster; probe bridge/ffmpeg async */
      return (
        '<div class="dam-branding-thumb__video-wrap" data-path="' +
        esc(path) +
        '" data-poster="' +
        esc(poster) +
        '">' +
        '<video class="dam-viz-thumb__img dam-branding-thumb__video-el" muted playsinline preload="none" ' +
        'data-path="' +
        esc(path) +
        '" poster="' +
        esc(VIDEO_POSTER_FALLBACK) +
        '" src="' +
        esc(stream) +
        '" onloadeddata="this.parentElement&&this.parentElement.classList.add(\'is-loaded\')" onerror="window.__damBrandingVideoThumbFallback&&__damBrandingVideoThumbFallback(this)"></video>' +
        '<span class="dam-branding-thumb__play" aria-hidden="true"><i class="uil uil-play"></i></span>' +
        "</div>"
      );
    }
    if (a.media_type === "vector") {
      return (
        '<div class="dam-viz-thumb__noviz dam-branding-thumb__icon">' +
        '<i class="uil uil-vector-square" aria-hidden="true"></i><span>Wektor</span></div>'
      );
    }
    if (/\.(png|jpe?g|webp|gif|tiff?|psd|psb|bmp)$/i.test(a.name || "") || a.media_type === "source") {
      return (
        '<img class="dam-viz-thumb__img" data-path="' +
        esc(a.path || "") +
        '" src="' +
        esc(mediaUrl(a.path, a)) +
        '" alt="" loading="lazy" onerror="window.__damBrandingThumbFallback&&__damBrandingThumbFallback(this)">'
      );
    }
    if (/\.(ai|eps|svg)$/i.test(a.name || "")) {
      return (
        '<div class="dam-viz-thumb__noviz dam-branding-thumb__icon">' +
        '<i class="uil uil-image-v" aria-hidden="true"></i><span>' +
        esc((a.media_type || "plik").toUpperCase()) +
        "</span></div>"
      );
    }
    return (
      '<div class="dam-viz-thumb__noviz dam-branding-thumb__icon">' +
      '<i class="uil uil-file" aria-hidden="true"></i><span>' +
      esc((a.media_type || "plik").toUpperCase()) +
      "</span></div>"
    );
  }

  function cardHtml(a, siblings, cardOpts) {
    cardOpts = cardOpts || {};
    var hint = folderHint(a.path);
    var assetList = siblings && siblings.length ? siblings : [a];
    var cardAsset =
      siblings && siblings.length > 1 ? pickPrimaryMarketing(siblings) || a : a;
    var thumbAsset = pickPrimaryMarketing(assetList) || cardAsset;
    var displayAssets = brandingCardDisplayAssets(assetList);
    var displayCount = displayAssets.length || assetList.length;
    var tileCls =
      window.DamBadges && typeof window.DamBadges.brandingGradientTileClass === "function"
        ? window.DamBadges.brandingGradientTileClass(cardAsset)
        : "";
    var groupIds =
      assetList.length > 1
        ? assetList
            .map(function (x) {
              return x.id;
            })
            .join(",")
        : "";
    var displayTitle = cardOpts.title || cardAsset.name;
    var metaLine = brandingCardTypeMeta(cardAsset);
    var isVideoCard = cardAsset.media_type === "video";
    return (
      '<article class="dam-viz-card dam-branding-card dam-viz-card--clickable' +
      (isVideoCard ? " dam-branding-card--video" : "") +
      (tileCls ? " " + tileCls : "") +
      '" data-id="' +
      esc(cardAsset.id) +
      '"' +
      (groupIds ? ' data-group-ids="' + esc(groupIds) + '"' : "") +
      ' title="Kliknij, aby otworzyć podgląd">' +
      '<div class="dam-viz-thumb">' +
      brandingCardVariantBadgeHtml(displayCount) +
      thumbHtml(thumbAsset) +
      "</div>" +
      '<div class="dam-viz-card__body">' +
      '<div class="dam-viz-card__badges">' +
      badgesHtml(cardAsset) +
      "</div>" +
      brandingCardTitleHtml(displayTitle, brandingCardSubtitle(cardAsset, displayTitle), "") +
      brandingCardMetaHtml(metaLine || hint || cardAsset.sku || "Materiał", metaAssetIdsForCard(cardAsset, assetList)) +
      '<div class="dam-viz-card__footer">' +
      brandingCardIndexBlockHtml(assetList) +
      brandingCardActionsHtml(cardAsset) +
      "</div>" +
      "</div></article>"
    );
  }

  function groupCardHtml(entry, gridOpts) {
    gridOpts = gridOpts || {};
    var isKv = gridOpts.groupMode === "keyvisuale";
    var isProject = gridOpts.groupMode === "project";
    var assets = entry.assets || [];
    var primary = entry.primary || assets[0];
    if (!primary) return "";
    var hint = folderHint(primary.path);
    var tileCls =
      window.DamBadges && typeof window.DamBadges.brandingGradientTileClass === "function"
        ? window.DamBadges.brandingGradientTileClass(primary)
        : "";
    var ids = assets
      .map(function (x) {
        return x.id;
      })
      .join(",");
    var displayAssets = brandingCardDisplayAssets(assets);
    var displayCount = displayAssets.length || assets.length;
    var groupTitle = entry.label || primary.name;
    var groupMeta = brandingCardTypeMeta(primary);
    var cardTitle = isProject
      ? "Kliknij, aby przejrzeć pliki projektu"
      : isKv
        ? "Kliknij, aby przejrzeć wizualizacje produktu"
        : "Kliknij, aby przejrzeć warianty materiału";
    return (
      '<article class="dam-viz-card dam-branding-card dam-branding-card--group dam-viz-card--clickable' +
      (tileCls ? " " + tileCls : "") +
      '" data-id="' +
      esc(primary.id) +
      '" data-group-ids="' +
      esc(ids) +
      '" title="' +
      esc(cardTitle) +
      '">' +
      '<div class="dam-viz-thumb">' +
      brandingCardVariantBadgeHtml(displayCount) +
      thumbStackHtml(assets, primary) +
      "</div>" +
      '<div class="dam-viz-card__body">' +
      '<div class="dam-viz-card__badges">' +
      badgesHtml(primary) +
      "</div>" +
      brandingCardTitleHtml(groupTitle, brandingCardSubtitle(primary, groupTitle), "") +
      brandingCardMetaHtml(groupMeta || hint || "Materiał", metaAssetIdsForCard(primary, assets)) +
      '<div class="dam-viz-card__footer">' +
      brandingCardIndexBlockHtml(assets) +
      brandingCardActionsHtml(primary) +
      "</div>" +
      "</div></article>"
    );
  }

  function gridEntryHtml(entry, gridOpts) {
    gridOpts = gridOpts || {};
    if (!entry) return "";
    if (entry.type === "group") return groupCardHtml(entry, gridOpts);
    var assets = asAssetList(entry.assets);
    if (!assets.length) return "";
    var a = assets[0];
    if (gridOpts.groupMode === "keyvisuale") {
      return cardHtml(a, assets, {
        title: keyVisualGroupLabel([a]),
        meta: keyVisualGroupMeta([a]) || folderHint(a.path) || a.sku,
      });
    }
    if (gridOpts.groupMode === "project") {
      return cardHtml(a, assets, {
        title: marketingGroupLabel([a]),
        meta: marketingGroupMeta(assets) || folderHint(a.path),
      });
    }
    return cardHtml(a, assets);
  }

  function activeFilterHint() {
    var parts = [];
    var q = elVal("damBrandingSearch");
    if (q) parts.push("wyszukiwanie: „" + q + "”");
    Object.keys(activeTagFilters).forEach(function (key) {
      if (!activeTagFilters[key]) return;
      var label = key.split(":").slice(1).join(":");
      parts.push("tag: " + label);
    });
    if (graphicsOnlyActive() && !activeTagFilters["media:document"]) parts.push("tylko grafiki");
    if (includeArchive()) parts.push("archiwum: włączone");
    if (discoveryWhen) {
      var whenLbl = (WHEN_CHIPS.filter(function (w) { return w.id === discoveryWhen; })[0] || {}).label;
      if (whenLbl) parts.push("kiedy: " + whenLbl);
    }
    if (productCorrelation && productCorrelation.productId) {
      parts.push("produkt: " + productCorrelation.productId);
    }
    return parts.length ? " · filtr: " + parts.join(", ") : "";
  }

  function fmtGridCount(n) {
    return String(Math.max(0, n | 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  /** Polska odmiana: 1 element, 2-4 elementy, 5+ elementów (z wyjątkiem nastek). */
  function plWord(n, one, few, many) {
    n = Math.abs(n | 0);
    if (n === 1) return one;
    var d = n % 10;
    var h = n % 100;
    if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return few;
    return many;
  }

  function fmtElements(n) {
    return fmtGridCount(n) + " " + plWord(n, "element", "elementy", "elementów");
  }

  function fmtFiles(n) {
    return fmtGridCount(n) + " " + plWord(n, "plik", "pliki", "plików");
  }

  function countSliceAssets(slice) {
    var n = 0;
    (slice || []).forEach(function (entry) {
      n += (entry.assets || []).length;
    });
    return n;
  }

  function updateGridCount(shownSlice, assetList, limit, gridOpts, totalCardsPre) {
    var el = document.getElementById("damBrandingGridCount");
    if (!el) return;
    var panel = document.getElementById("damBrandingPanelSection");
    if (!panel || panel.hidden || currentSectionTab() === "brandbook") {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    assetList = asAssetList(assetList);
    var filesShown = countSliceAssets(shownSlice);
    var cardsShown = (shownSlice || []).length;
    var totalFiles = assetList.length;
    /* Grupowanie policzone raz w renderActiveSection - nie licz drugi raz */
    var totalCards =
      typeof totalCardsPre === "number"
        ? totalCardsPre
        : groupBrandingAssets(assetList, gridOpts || {}).length;
    if (!filesShown) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    /* Format usera: najpierw ELEMENTY (karty/grupy), potem pliki */
    var elsPart =
      cardsShown < totalCards
        ? fmtGridCount(cardsShown) + " / " + fmtElements(totalCards)
        : fmtElements(cardsShown);
    var filesPart =
      filesShown < totalFiles
        ? fmtGridCount(filesShown) + " / " + fmtFiles(totalFiles)
        : fmtFiles(filesShown);
    el.textContent = elsPart + " • " + filesPart;
    el.hidden = false;
  }

  function setStatusEl(el, groupedSlice, assetTotal, limit) {
    if (!el) return;
    var built = index && index.built_at ? String(index.built_at).slice(0, 19).replace("T", " ") : "";
    var meta = "";
    if (index && index.wizki_count != null) meta += " · WIZKI " + index.wizki_count;
    if (index && index.perspective_count != null) meta += " · perspektywy " + index.perspective_count;
    var cardN = (groupedSlice || []).length;
    var assetN = assetTotal || 0;
    var filesShown = countSliceAssets(groupedSlice);
    /* Format usera: najpierw ELEMENTY (karty), potem pliki */
    var countLine =
      fmtElements(cardN) +
      " • " +
      (filesShown !== assetN
        ? fmtGridCount(filesShown) + " / " + fmtFiles(assetN)
        : fmtFiles(assetN));
    el.textContent =
      countLine +
      (built ? " · indeks " + built : "") +
      meta +
      (cardN >= limit ? " · limit " + fmtGridCount(limit) + " kart" : "") +
      activeFilterHint();
  }

  function activeFilterLabels() {
    var parts = [];
    var q = elVal("damBrandingSearch");
    if (q) parts.push("Szukaj: " + q);
    Object.keys(activeTagFilters).forEach(function (key) {
      if (!activeTagFilters[key]) return;
      var label = key.split(":").slice(1).join(":");
      parts.push(label);
    });
    if (graphicsOnlyActive() && !activeTagFilters["media:document"]) parts.push("Tylko grafiki");
    if (includeArchive()) parts.push("Archiwum");
    if (discoveryWhen) {
      var whenLbl = (WHEN_CHIPS.filter(function (w) { return w.id === discoveryWhen; })[0] || {}).label;
      if (whenLbl) parts.push("Kiedy: " + whenLbl);
    }
    var bounds = dateRangeBounds();
    if (bounds.from || bounds.to) parts.push("Zakres dat");
    return parts;
  }

  function pickEmptyMascotBundle() {
    if (window.DamEmptyMascot && typeof window.DamEmptyMascot.pick === "function") {
      return window.DamEmptyMascot.pick();
    }
    return {
      text: "Skryło się to tak, że nawet najstarsi graficy tego nie znajdą.",
      mood: "think",
      poseUrl: "assets/img/maskotka/pose-think-q.png"
    };
  }

  function wrapEmptyWithMascot(cardHtml) {
    var bundle = pickEmptyMascotBundle();
    var pose = String(bundle.poseUrl || "").replace(/'/g, "%27");
    var line = bundle.text || "";
    return (
      '<div class="dam-empty-mascot-row" data-empty-mood="' +
      esc(bundle.mood || "think") +
      '">' +
      '<div class="dam-empty-mascot-row__speak">' +
      '<div class="dam-empty-mascot-row__bubble">' +
      '<p class="dam-empty-mascot-row__bubble-text">' +
      esc(line) +
      "</p>" +
      "</div>" +
      '<div class="dam-empty-mascot-row__mascot" aria-hidden="true" style="--dam-empty-pose:url(\'' +
      pose +
      "')\">" +
      '<span class="dam-empty-mascot-row__mascot-img"></span>' +
      "</div>" +
      "</div>" +
      '<div class="dam-empty-mascot-row__card">' +
      cardHtml +
      "</div>" +
      "</div>"
    );
  }

  function emptyGridMessage(defaultMsg, totalBeforeLimit) {
    if (totalBeforeLimit > 0) {
      return wrapEmptyWithMascot(
        '<div class="dam-branding-empty dam-branding-empty--limited" role="status">' +
          '<p class="dam-branding-empty__desc">' +
          esc(defaultMsg) +
          "</p></div>"
      );
    }
    var filters = activeFilterLabels();
    var filterHtml = filters.length
      ? '<ul class="dam-branding-empty__filters">' +
        filters
          .map(function (f) {
            return "<li>" + esc(f) + "</li>";
          })
          .join("") +
        "</ul>"
      : "";
    return wrapEmptyWithMascot(
      '<div class="dam-branding-empty" role="status">' +
        '<div class="dam-branding-empty__icon" aria-hidden="true"><i class="uil uil-image-slash"></i></div>' +
        '<h3 class="dam-branding-empty__title">Brak wyników</h3>' +
        '<p class="dam-branding-empty__desc">Żaden materiał nie pasuje do aktywnych filtrów w tej sekcji.</p>' +
        filterHtml +
        '<button type="button" class="geex-btn geex-btn--primary-transparent dam-branding-clear-filters">Wyczyść filtry</button>' +
        "</div>"
    );
  }

  function renderAssetGrid(grid, list, limit, emptyMsg, totalCount, gridOpts) {
    if (!grid) return [];
    gridOpts = gridOpts || {};
    list = asAssetList(list);
    var grouped = groupBrandingAssets(list, gridOpts);
    lastGroupedTotal = grouped.length;
    var slice = grouped.slice(0, limit);
    var total = totalCount != null ? totalCount : list.length;
    grid.innerHTML = slice.length
      ? slice
          .map(function (entry) {
            return gridEntryHtml(entry, gridOpts);
          })
          .join("")
      : '<div class="dam-branding-empty-wrap">' + emptyGridMessage(emptyMsg || "Brak wyników dla wybranych filtrów.", total) + "</div>";
    var clearBtn = grid.querySelector(".dam-branding-clear-filters");
    if (clearBtn) {
      clearBtn.addEventListener("click", clearAllBrandingFilters);
    }
    bindCards(grid);
    hydrateVideoPosters(grid);
    currentGridAssets = [];
    slice.forEach(function (entry) {
      (entry.assets || []).forEach(function (a) {
        currentGridAssets.push(a);
      });
    });
    if (window.DamBadges && typeof window.DamBadges.bindClicks === "function") {
      window.DamBadges.bindClicks(grid, "branding");
    }
    if (slice.length && window.DamGridReveal) {
      window.DamGridReveal.reveal(grid, window.DamGridReveal.selectors.vizCard);
    }
    if (window.DamGridReveal && window.DamGridReveal.revealBars) {
      window.DamGridReveal.revealBars(document);
    }
    return slice;
  }

  function renderGrid() {
    renderActiveSection();
  }

  function renderKeyVisuale() {
    renderActiveSection();
  }

  function bindMetaTooltips(grid) {
    if (!grid) return;
    var tipEl = document.getElementById("damBrandingMetaTip");
    if (!tipEl) {
      tipEl = document.createElement("div");
      tipEl.id = "damBrandingMetaTip";
      tipEl.className = "dam-branding-meta-tip";
      tipEl.setAttribute("role", "tooltip");
      tipEl.hidden = true;
      document.body.appendChild(tipEl);
    }
    var hideTip = function () {
      tipEl.hidden = true;
    };
    grid.querySelectorAll(".dam-viz-card__meta[data-branding-meta-ids]").forEach(function (meta) {
      meta.addEventListener("mouseenter", function () {
        var raw = meta.getAttribute("data-branding-meta-ids") || "";
        var ids = raw.split(",").filter(Boolean);
        if (!ids.length) return;
        var chips = ids
          .map(function (id) {
            var asset = ((index && index.assets) || []).find(function (a) {
              return a.id === id;
            });
            var label = asset ? marketingDisplayId(asset) : id;
            return '<span class="dam-viz-badge dam-viz-badge--index">' + esc(label) + "</span>";
          })
          .join("");
        tipEl.innerHTML = '<div class="dam-branding-meta-tip__label">Indeksy w grupie</div><div class="dam-branding-meta-tip__chips">' + chips + "</div>";
        var r = meta.getBoundingClientRect();
        tipEl.hidden = false;
        tipEl.style.left = Math.max(8, r.left + r.width / 2 - tipEl.offsetWidth / 2) + "px";
        tipEl.style.top = Math.max(8, r.top - tipEl.offsetHeight - 8) + "px";
      });
      meta.addEventListener("mouseleave", hideTip);
      meta.addEventListener("click", hideTip);
    });
    if (!grid.__damMetaTipBound) {
      grid.__damMetaTipBound = true;
      window.addEventListener("scroll", hideTip, true);
    }
  }

  function bindCards(grid) {
    grid.querySelectorAll(".dam-branding-card").forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        if (ev.target.closest(".dam-viz-badge")) return;
        if (ev.target.closest(".dam-viz-card__actions")) return;
        var id = btn.getAttribute("data-id");
        var ids = (btn.getAttribute("data-group-ids") || "").split(",").filter(Boolean);
        var siblings = null;
        if (ids.length > 1 && index && index.assets) {
          var map = {};
          (index.assets || []).forEach(function (a) {
            map[a.id] = a;
          });
          siblings = ids.map(function (gid) {
            return map[gid];
          }).filter(Boolean);
        }
        openModal(id, siblings);
      });
    });

    grid.querySelectorAll(".dam-branding-preview-btn").forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var card = btn.closest(".dam-branding-card");
        if (!card) return;
        var id = card.getAttribute("data-id");
        var ids = (card.getAttribute("data-group-ids") || "").split(",").filter(Boolean);
        var siblings = null;
        if (ids.length > 1 && index && index.assets) {
          var map = {};
          (index.assets || []).forEach(function (a) {
            map[a.id] = a;
          });
          siblings = ids.map(function (gid) {
            return map[gid];
          }).filter(Boolean);
        }
        openModal(id, siblings);
      });
    });

    grid.querySelectorAll(".dam-viz-win-explorer-btn").forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var path = btn.getAttribute("data-path") || "";
        if (!path) return;
        if (window.DamPaths && typeof window.DamPaths.openFolderInExplorer === "function") {
          window.DamPaths.openFolderInExplorer(path);
          return;
        }
        if (window.DamPaths) window.DamPaths.revealInExplorer(path);
      });
    });

    grid.querySelectorAll(".dam-branding-card__id-chip, .dam-viz-card__id-chip").forEach(function (chip) {
      chip.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var text = chip.getAttribute("data-copy-id") || chip.textContent.trim();
        if (!text) return;
        var toast = function (msg) {
          if (typeof window.damShowToast === "function") {
            window.damShowToast(msg);
            return;
          }
          /* ten sam mechanizm co toastCopied w dam-badges.js */
          var t = document.getElementById("damGlobalToast");
          if (!t) {
            t = document.createElement("div");
            t.id = "damGlobalToast";
            t.className = "dam-global-toast";
            t.setAttribute("role", "status");
            document.body.appendChild(t);
          }
          t.textContent = msg;
          t.classList.add("is-on");
          clearTimeout(t._t);
          t._t = setTimeout(function () {
            t.classList.remove("is-on");
          }, 1600);
        };
        var onOk = function () {
          toast("Skopiowano: " + text);
        };
        var onFail = function () {
          toast("Nie udało się skopiować");
        };
        if (window.DamBadges && typeof window.DamBadges.copyTagText === "function") {
          window.DamBadges.copyTagText(chip).then(onOk).catch(onFail);
        } else if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(onOk).catch(onFail);
        }
      });
    });

    if (window.DamCardIndexPopover && typeof window.DamCardIndexPopover.bind === "function") {
      window.DamCardIndexPopover.bind(grid);
    } else {
      grid.querySelectorAll(".dam-viz-card__show-indexes").forEach(function (btn) {
        btn.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          var wrap = btn.parentNode && btn.parentNode.querySelector(".dam-viz-card__indexes-wrap");
          if (!wrap) return;
          var open = wrap.hasAttribute("hidden");
          if (open) wrap.removeAttribute("hidden");
          else wrap.setAttribute("hidden", "");
          btn.setAttribute("aria-expanded", open ? "true" : "false");
        });
      });
    }

    grid.querySelectorAll(".dam-branding-share-btn").forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var path = btn.getAttribute("data-path") || "";
        var syEnabled = localStorage.getItem("dam_synology_enabled") !== "false";
        if (!syEnabled) {
          if (window.DamToast) window.DamToast.show("Włącz Synology Drive w Ustawieniach");
          return;
        }
        if (window.DamPaths && typeof window.DamPaths.shareViaSynology === "function") {
          window.DamPaths.shareViaSynology(path);
        }
      });
    });
    bindMetaTooltips(grid);
  }

  function folderDirFromPath(path) {
    var p = String(path || "").replace(/\\/g, "/");
    var i = p.lastIndexOf("/");
    return i >= 0 ? p.slice(0, i).toLowerCase() : p.toLowerCase();
  }

  function isRasterAssetName(name) {
    return /\.(jpe?g|png|webp|gif|tiff?|bmp)$/i.test(String(name || ""));
  }

  function variantLabelFromAsset(a) {
    if (a && a.dimensions_px) return a.dimensions_px;
    var n = String((a && a.name) || "");
    if (/\.psd$/i.test(n)) return "PSD";
    if (/\.psb$/i.test(n)) return "PSB";
    if (/\.ai$/i.test(n)) return "AI";
    if (/desktop/i.test(n) || /1920\s*[x×]\s*600/i.test(n)) return "Desktop";
    if (/tablet/i.test(n) || /992\s*[x×]\s*600/i.test(n)) return "Tablet";
    if (/mobile/i.test(n) || /576\s*[x×]\s*600/i.test(n)) return "Mobile";
    var paren = n.match(/\((\d+)\)/);
    if (paren) {
      var slot = +paren[1];
      if (slot === 1) return "Desktop";
      if (slot === 2) return "Tablet";
      if (slot === 3) return "Mobile";
    }
    // Brak rozmiaru - pokaz baze nazwy pliku zamiast generycznego "Plik"
    var base = n.replace(/\.[A-Za-z0-9]{1,8}$/, "").trim();
    return base || "Plik";
  }

  function assetDirKey(path) {
    var p = String(path || "").replace(/\\/g, "/");
    var i = p.lastIndexOf("/");
    return i > 0 ? p.slice(0, i).toLowerCase() : "";
  }

  /** Odrzuc folder_variants spoza folderu primary (spaczone wpisy indeksu). */
  function variantSameFolderAsPrimary(primary, variantRef, assetsById) {
    if (!primary || !variantRef || !variantRef.id) return false;
    if (variantRef.id === primary.id) return true;
    var va = (assetsById && assetsById[variantRef.id]) || variantRef;
    if (!primary.path || !va.path) return false;
    return assetDirKey(primary.path) === assetDirKey(va.path);
  }

  function filterFolderVariantsForPrimary(primary, variants, assetsById) {
    return (variants || []).filter(function (v) {
      return variantSameFolderAsPrimary(primary, v, assetsById);
    });
  }

  function ensurePrimaryFirstInList(list, primary) {
    list = (list || []).filter(Boolean);
    if (!primary) return list;
    if (!list.length) return [primary];
    var rest = list.filter(function (x) {
      return x && x.id !== primary.id;
    });
    return [primary].concat(rest);
  }

  function buildBrandingGroupContext(primary, assetsById, optSiblings) {
    var variants = filterFolderVariantsForPrimary(
      primary,
      (primary && primary.folder_variants) || [],
      assetsById
    );
    var linked = (primary && primary.linked_products) || [];
    var editable = (primary && primary.folder_editable_files) || [];
    var groupId = (primary && primary.folder_group_id) || folderDirFromPath(primary && primary.path);

    if (optSiblings && optSiblings.length > 1) {
      variants = optSiblings.map(function (x) {
        return {
          id: x.id,
          name: x.name,
          path: x.path,
          label: variantLabelFromAsset(x),
          media_type: x.media_type || "",
        };
      });
      var order = { Desktop: 0, Tablet: 1, Mobile: 2 };
      variants.sort(function (a, b) {
        return (order[a.label] != null ? order[a.label] : 9) - (order[b.label] != null ? order[b.label] : 9);
      });
    } else if ((!variants || variants.length <= 1) && groupId && assetsById) {
      var mates = [];
      Object.keys(assetsById).forEach(function (id) {
        var x = assetsById[id];
        if (!x || !isRasterAssetName(x.name)) return;
        var xGroup = x.folder_group_id || folderDirFromPath(x.path);
        if (xGroup === groupId) mates.push(x);
      });
      if (mates.length > 1) {
        variants = mates.map(function (x) {
          return {
            id: x.id,
            name: x.name,
            path: x.path,
            label: variantLabelFromAsset(x),
            media_type: x.media_type || "",
          };
        });
        var order = { Desktop: 0, Tablet: 1, Mobile: 2 };
        variants.sort(function (a, b) {
          return (order[a.label] != null ? order[a.label] : 9) - (order[b.label] != null ? order[b.label] : 9);
        });
      }
    }

    if ((!linked || !linked.length) && primary) {
      if (primary.linked_products && primary.linked_products.length) {
        linked = primary.linked_products;
      } else if (primary.folder_linked_product_ids && primary.folder_linked_product_ids.length) {
        linked = primary.folder_linked_product_ids.map(function (pid) {
          return { id: pid, display_name: pid, thumb_url: "" };
        });
      }
    }
    if ((!linked || !linked.length) && groupId && assetsById) {
      Object.keys(assetsById).some(function (fid) {
        var x = assetsById[fid];
        if (!x) return false;
        if ((x.folder_group_id || folderDirFromPath(x.path)) !== groupId) return false;
        if (x.linked_products && x.linked_products.length) {
          linked = x.linked_products;
          return true;
        }
        if (x.folder_linked_product_ids && x.folder_linked_product_ids.length) {
          linked = x.folder_linked_product_ids.map(function (pid) {
            return { id: pid, display_name: pid, thumb_url: "" };
          });
          return true;
        }
        return false;
      });
    }

    /* Cross-folder linked_variant_ids (np. M-SHOP405515 → M-IMG205857) — grid wariantów. */
    var linkedVarIds = (primary && primary.linked_variant_ids) || [];
    if (linkedVarIds.length) {
      var seenVar = {};
      (variants || []).forEach(function (v) {
        if (v && v.id) seenVar[v.id] = true;
      });
      linkedVarIds.forEach(function (lid) {
        if (!lid || seenVar[lid]) return;
        var va = assetsById && assetsById[lid];
        if (va) {
          seenVar[lid] = true;
          variants.push({
            id: va.id,
            name: va.name,
            path: va.path,
            label: variantLabelFromAsset(va),
            media_type: va.media_type || "",
          });
        } else if (lid !== (primary && primary.id)) {
          seenVar[lid] = true;
          variants.push({ id: lid, name: lid });
        }
      });
    }

    // Zawsze uzupelnij PSD/PSB/AI z tej samej grupy folderu (nie tylko gdy lista pusta).
    if (groupId && assetsById) {
      var seenPath = {};
      editable.forEach(function (f) {
        if (f && f.path) seenPath[String(f.path).toLowerCase()] = true;
      });
      Object.keys(assetsById).forEach(function (id) {
        var x = assetsById[id];
        if (!x || !/\.(psd|psb|ai|eps|indd)$/i.test(x.name || "")) return;
        if ((x.folder_group_id || folderDirFromPath(x.path)) !== groupId) return;
        var key = String(x.path || "").toLowerCase();
        if (!key || seenPath[key]) return;
        seenPath[key] = true;
        editable.push({
          id: x.id,
          name: x.name,
          path: x.path,
          mtime: x.mtime || null,
          mtime_ms: typeof x.mtime_ms === "number" ? x.mtime_ms : null,
        });
      });
    }

    return {
      variants: variants || [],
      linked_products: linked || [],
      linked_variant_ids: (primary && primary.linked_variant_ids) || [],
      folder_group_id: groupId || "",
      folder_editable_files: editable || [],
    };
  }

  function openModal(id, siblings) {
    var assetsById = {};
    ((index && index.assets) || []).forEach(function (a) {
      assetsById[a.id] = a;
    });
    var primary = assetsById[id];
    if (!primary) return;

    function launchModal() {
      if (window.DamAssocEdit && typeof window.DamAssocEdit.applyAssetAssocOverrides === "function") {
        primary = window.DamAssocEdit.applyAssetAssocOverrides(primary);
        assetsById[id] = primary;
      }
    var list = [];
    if (siblings && siblings.length > 1) {
      list = siblings.filter(Boolean);
    }
    if (!list.length) {
      list = [primary];
      if (primary.folder_variants && primary.folder_variants.length) {
        filterFolderVariantsForPrimary(primary, primary.folder_variants, assetsById).forEach(
          function (v) {
            if (!v || !v.id || v.id === primary.id) return;
            var va = assetsById[v.id];
            if (va && !list.some(function (x) {
              return x.id === va.id;
            })) {
              list.push(va);
            }
          }
        );
      }
    }
    list = ensurePrimaryFirstInList(list, primary);

    var displayList = brandingCardDisplayAssets(list);
    if (displayList.length > 1) {
      list = ensurePrimaryFirstInList(displayList, primary);
    }

    var groupContext = buildBrandingGroupContext(primary, assetsById, list.length > 1 ? list : null);
    if (list.length <= 1 && groupContext.variants && groupContext.variants.length > 1) {
      var fromGc = groupContext.variants
        .map(function (v) {
          return v.id && assetsById[v.id];
        })
        .filter(Boolean)
        .filter(function (va) {
          return variantSameFolderAsPrimary(primary, va, assetsById);
        });
      if (fromGc.length > 1) {
        list = ensurePrimaryFirstInList(fromGc, primary);
        groupContext = buildBrandingGroupContext(primary, assetsById, list);
      }
    }

    var idx = list.findIndex(function (x) {
      return x.id === id;
    });
    if (idx < 0) idx = 0;
    var a = list[idx] || primary;
    if (!a) return;
    trackRecentAsset(a);
    if (window.DamMediaPreview && typeof window.DamMediaPreview.openAsset === "function") {
      window.DamMediaPreview.openAsset(a, {
        siblings: list,
        index: idx,
        alwaysShowAssociations: true,
        groupContext: groupContext,
      });
    }
    }

    var chain = Promise.resolve();
    if (window.DamAssocEdit && typeof window.DamAssocEdit.loadAssocOverrides === "function") {
      chain = window.DamAssocEdit.loadAssocOverrides();
    }
    chain
      .then(function () {
        return fetchFullAsset(id);
      })
      .then(function (full) {
        if (full && typeof full === "object") {
          primary = Object.assign({}, primary, full, { id: primary.id || full.id });
          assetsById[id] = primary;
          if (index && Array.isArray(index.assets)) {
            var ix = index.assets.findIndex(function (x) {
              return x && x.id === id;
            });
            if (ix >= 0) index.assets[ix] = Object.assign({}, index.assets[ix], primary);
          }
        }
        launchModal();
      })
      .catch(function () {
        launchModal();
      });
  }

  function closeModal() {
    var modal = document.getElementById("damMediaPreview");
    if (modal) modal.remove();
  }

  function getCampaignList() {
    var list = (campaigns && campaigns.campaigns) || [];
    if (!list.length) {
      var map = {};
      ((index && index.assets) || []).forEach(function (a) {
        if (!a.campaign_id) return;
        map[a.campaign_id] = (map[a.campaign_id] || 0) + 1;
      });
      list = Object.keys(map)
        .sort()
        .map(function (k) {
          return { id: k, nazwa: k, asset_count: map[k] };
        });
    }
    return list.slice().sort(function (a, b) {
      var na = a.asset_count != null ? a.asset_count : (a.asset_ids || []).length;
      var nb = b.asset_count != null ? b.asset_count : (b.asset_ids || []).length;
      return nb - na;
    });
  }

  function campaignLabel(c) {
    var raw = c.nazwa || c.id || "";
    if (raw.length > 48) return raw.slice(0, 45) + "…";
    return raw;
  }

  async function renderCampaigns() {
    var chipsHost = document.getElementById("damBrandingCampaignChips");
    var grid = document.getElementById("damBrandingCampaignGrid");
    var statusEl = document.getElementById("damBrandingCampaignStatus");
    if (!chipsHost || !grid) return;
    await loadCampaigns();
    var list = getCampaignList();
    if (!list.length) {
      chipsHost.innerHTML = "";
      grid.innerHTML = '<p class="dam-branding-muted">Brak kampanii w indeksie.</p>';
      if (statusEl) statusEl.textContent = "";
      return;
    }
    if (!selectedCampaignId || !list.some(function (c) { return c.id === selectedCampaignId; })) {
      selectedCampaignId = list[0].id;
    }
    chipsHost.innerHTML = list
      .map(function (c) {
        var n = c.asset_count != null ? c.asset_count : (c.asset_ids || []).length;
        var active = c.id === selectedCampaignId ? " is-active" : "";
        return (
          '<button type="button" class="dam-branding-campaign-chip' +
          active +
          '" data-campaign="' +
          esc(c.id) +
          '" role="tab" aria-selected="' +
          (active ? "true" : "false") +
          '">' +
          esc(campaignLabel(c)) +
          ' <span class="dam-branding-campaign-chip__count">' +
          n +
          "</span></button>"
        );
      })
      .join("");
    chipsHost.querySelectorAll(".dam-branding-campaign-chip").forEach(function (btn) {
      btn.addEventListener("click", function () {
        selectedCampaignId = btn.getAttribute("data-campaign") || "";
        renderCampaigns();
      });
    });
    var all = filteredAssets({ campaignId: selectedCampaignId });
    var shown = renderAssetGrid(
      grid,
      all,
      GRID_LIMIT_TAB,
      "Brak assetów w tej kampanii (sprawdź filtry u góry)."
    );
    setStatusEl(statusEl, shown, all.length, GRID_LIMIT_TAB);
  }

  function renderChannels() {
    var pillsHost = document.getElementById("damBrandingChannelPills");
    var grid = document.getElementById("damBrandingChannelGrid");
    var statusEl = document.getElementById("damBrandingChannelStatus");
    if (!pillsHost || !grid) return;
    var channels = [
      { id: "", label: "Wszystkie" },
      { id: "www", label: "WWW" },
      { id: "meta", label: "Meta" },
      { id: "instagram", label: "Instagram" },
      { id: "google", label: "Google" },
    ];
    pillsHost.innerHTML = channels
      .map(function (ch) {
        var active = ch.id === selectedChannel ? " is-active" : "";
        return (
          '<button type="button" class="dam-branding-channel-pill' +
          active +
          '" data-channel="' +
          esc(ch.id) +
          '" role="tab" aria-selected="' +
          (active ? "true" : "false") +
          '">' +
          esc(ch.label) +
          "</button>"
        );
      })
      .join("");
    pillsHost.querySelectorAll(".dam-branding-channel-pill").forEach(function (btn) {
      btn.addEventListener("click", function () {
        selectedChannel = btn.getAttribute("data-channel") || "";
        renderChannels();
        renderGrid();
        renderKeyVisuale();
      });
    });
    var all = filteredAssets({ channelKey: selectedChannel });
    var shown = renderAssetGrid(
      grid,
      all,
      GRID_LIMIT_TAB,
      "Brak materiałów dla tego kanału."
    );
    setStatusEl(statusEl, shown, all.length, GRID_LIMIT_TAB);
  }

  function renderBrandbook() {
    var host = document.getElementById("damBrandbookTokens");
    if (host) {
      host.innerHTML = (tokens.colors || [])
        .map(function (c) {
          return (
            '<div class="dam-brandbook-swatch" style="background:' +
            esc(c.hex) +
            '"><strong style="color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.4)">' +
            esc(c.name) +
            "</strong><br><code>" +
            esc(c.hex) +
            "</code></div>"
          );
        })
        .join("");
    }
    var grid = document.getElementById("damBrandbookGrid");
    if (grid) {
      var all = filteredAssets({ brandbookOnly: true });
      renderAssetGrid(grid, all, GRID_LIMIT_TAB, "Brak assetów brandbook w indeksie.", null, {
        groupMode: "project",
      });
    }
  }

  function renderLayoutPresets() {
    var host = document.getElementById("damBrandingLayoutPresets");
    if (!host) return;
    var presets = [
      { id: "shop-848x1200", label: "Zestaw sklepu 848×1200", w: 848, h: 1200 },
      { id: "slider-cat", label: "Slider kategorii", w: 1920, h: 600 },
      { id: "hero-www", label: "Slider główny WWW", w: 1920, h: 800 },
    ];
    host.innerHTML = presets
      .map(function (p) {
        return (
          '<article class="dam-branding-layout-preset geex-card"><h4 class="dam-hub-section-title">' +
          esc(p.label) +
          '</h4><div class="dam-branding-layout-frame" style="aspect-ratio:' +
          p.w +
          "/" +
          p.h +
          '"><span>' +
          p.w +
          "×" +
          p.h +
          "</span></div></article>"
        );
      })
      .join("");
  }

  function tabFromHash() {
    var h = String(location.hash || "")
      .replace(/^#/, "")
      .toLowerCase();
    var map = {
      all: "all",
      wszystko: "all",
      "pokaz-wszystko": "all",
      "pokaz_wszystko": "all",
      campaigns: "campaigns",
      kampanie: "campaigns",
      social: "social",
      channels: "social",
      kanaly: "social",
      www: "www",
      strony: "www",
      packshots: "packshots",
      packshoty: "packshots",
      keyvisuale: "packshots",
      "key-visuale": "packshots",
      brandbook: "brandbook",
      browse: "all",
      przeglądaj: "all",
    };
    return map[h] || null;
  }

  function hashForTab(tab) {
    var map = {
      all: "wszystko",
      campaigns: "kampanie",
      social: "social",
      www: "www",
      packshots: "packshoty",
      brandbook: "brandbook",
    };
    return map[tab] || tab;
  }

  function normalizeTab(tab) {
    if (tab === "browse" || tab === "layout") return "all";
    if (tab === "keyvisuale") return "packshots";
    if (tab === "channels") return "social";
    if (tab === "wszystko" || tab === "pokaz-wszystko") return "all";
    return tab || "all";
  }

  function activateTab(tab, opts) {
    opts = opts || {};
    tab = normalizeTab(tab);
    if (!opts.keepDiscovery) {
      discoveryWhen = "";
    }
    clearBrandingComputeCache();
    document.querySelectorAll(".dam-branding-tab").forEach(function (b) {
      var on = b.getAttribute("data-tab") === tab;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (!opts.skipTagRender) renderTagFilters();
    if (!opts.skipHash) {
      var nextHash = "#" + hashForTab(tab);
      if (location.hash !== nextHash) {
        history.replaceState(null, "", nextHash);
      }
    }
    if (tab === "all" || tab === "brandbook") hideCategoryHint();
    renderActiveSection();
  }

  function bindTabs() {
    document.querySelectorAll(".dam-branding-tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        activateTab(btn.getAttribute("data-tab") || "all");
      });
    });
  }

  var brandingSearchDebounceTimer = 0;
  function bindFilters() {
    ["damBrandingSearch", "damBrandingGraphicsOnly", "damBrandingDateFrom", "damBrandingDateTo", "damBrandingSort"].forEach(
      function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        var runFilter = function () {
          if (id === "damBrandingDateFrom" || id === "damBrandingDateTo") {
            datePresetActive = "";
            syncDatePresetButtons();
          }
          clearBrandingComputeCache();
          scheduleBrandingRender({ tags: true, section: true });
        };
        /* Perf: search to jedyne pole z akcja "per-keystroke" - facet-scan (O(assets x chipow))
           bez debounce potrafil odczuwalnie zawiesic UI przy szybkim pisaniu. */
        var handler = id === "damBrandingSearch"
          ? function () {
              if (brandingSearchDebounceTimer) clearTimeout(brandingSearchDebounceTimer);
              brandingSearchDebounceTimer = setTimeout(runFilter, 220);
            }
          : runFilter;
        el.addEventListener("input", handler);
        el.addEventListener("change", handler);
      }
    );
    var arch = document.getElementById("damBrandingIncludeArchive");
    if (arch) {
      arch.addEventListener("change", function () {
        renderTagFilters();
        renderActiveSection();
      });
    }
    var tagCounts = document.getElementById("damBrandingTagCounts");
    if (tagCounts) {
      tagCounts.checked = showTagCounts();
      tagCounts.addEventListener("change", function () {
        setShowTagCounts(tagCounts.checked);
        renderTagFilters();
      });
    }
    var presets = document.getElementById("damBrandingDatePresets");
    if (presets) {
      presets.addEventListener("click", function (e) {
        var btn = e.target.closest("button[data-preset]");
        if (!btn || !presets.contains(btn)) return;
        var p = btn.getAttribute("data-preset") || "";
        if (datePresetActive === p) applyDatePreset("");
        else applyDatePreset(p);
        renderTagFilters();
        renderActiveSection();
      });
    }
    var clearTags = document.getElementById("damBrandingClearTags");
    if (clearTags) {
      clearTags.addEventListener("click", clearAllBrandingFilters);
    }
    var backBtn = document.getElementById("damBrandingBackBtn");
    if (backBtn) {
      backBtn.addEventListener("click", clearAllBrandingFilters);
    }
  }

  function brandingCardZoomRoots() {
    return [
      document.getElementById("damBrandingSectionGrid"),
      document.getElementById("damBrandbookGrid"),
    ].filter(Boolean);
  }

  function applyBrandingCardZoom(pct) {
    /* HARD: one density system — DamCardZoom (media-preview) owns CSS vars + Shift+/-. */
    if (window.DamCardZoom && typeof window.DamCardZoom.apply === "function") {
      return window.DamCardZoom.apply(pct);
    }
    var n = Math.round(Number(pct) || 100);
    if (n < CARD_ZOOM_MIN) n = CARD_ZOOM_MIN;
    if (n > CARD_ZOOM_MAX) n = CARD_ZOOM_MAX;
    var imgScale = (n <= 100 ? n / 100 : 1) * CARD_IMG_BASE_SCALE;
    var cardScale = n <= 100 ? 1 : n / 100;
    var cardMin = Math.round(CARD_BASE_MIN_PX * cardScale) + "px";
    brandingCardZoomRoots().forEach(function (root) {
      root.style.setProperty("--dam-viz-img-scale", String(imgScale));
      root.style.setProperty("--dam-viz-card-scale", String(cardScale));
      root.style.setProperty("--dam-viz-card-min", cardMin);
    });
    var label = document.getElementById("damBrandingCardZoomLabel");
    if (label) label.textContent = n + "%";
    var input = document.getElementById("damBrandingCardZoom");
    if (input && String(input.value) !== String(n)) input.value = String(n);
    try {
      localStorage.setItem(CARD_ZOOM_KEY, String(n));
    } catch (e) {}
    if (window.DamUserPrefs && typeof DamUserPrefs.setCardZoom === "function") {
      DamUserPrefs.setCardZoom(n, true).catch(function () {});
    }
    return n;
  }

  function bindBrandingCardZoomControl() {
    var input = document.getElementById("damBrandingCardZoom");
    if (!input || input._damZoomBound) return;
    input._damZoomBound = true;
    var saved =
      window.DamUserPrefs && typeof DamUserPrefs.getCardZoom === "function"
        ? DamUserPrefs.getCardZoom()
        : parseInt(localStorage.getItem(CARD_ZOOM_KEY) || "100", 10);
    if (isNaN(saved)) saved = 100;
    applyBrandingCardZoom(saved);
    if (window.DamUserPrefs && typeof DamUserPrefs.load === "function") {
      DamUserPrefs.load().then(function (prefs) {
        if (prefs && prefs.card_zoom != null) applyBrandingCardZoom(prefs.card_zoom);
      });
    }
    input.addEventListener("input", function () {
      applyBrandingCardZoom(this.value);
    });
    input.addEventListener("change", function () {
      applyBrandingCardZoom(this.value);
    });
  }

  function clampPageSize(n) {
    n = Math.round(Number(n) || PAGE_SIZE_DEFAULT);
    if (isNaN(n)) n = PAGE_SIZE_DEFAULT;
    if (n < PAGE_SIZE_MIN) n = PAGE_SIZE_MIN;
    if (n > PAGE_SIZE_MAX) n = PAGE_SIZE_MAX;
    return n;
  }

  function readStoredPageSize() {
    /* Session/local (po OK) wygrywają z KV — unikamy race z /user-prefs. */
    try {
      var raw = sessionStorage.getItem(PAGE_SIZE_SESSION_KEY);
      if (raw != null && raw !== "") return clampPageSize(raw);
    } catch (eSess) { /* ignore */ }
    try {
      var ls = localStorage.getItem(PAGE_SIZE_SESSION_KEY);
      if (ls != null && ls !== "") return clampPageSize(ls);
    } catch (eLs) { /* ignore */ }
    try {
      if (window.DamUserPrefs && typeof window.DamUserPrefs.getSync === "function") {
        var prefs = window.DamUserPrefs.getSync();
        if (prefs && prefs.branding_page_size != null) {
          return clampPageSize(prefs.branding_page_size);
        }
      }
    } catch (ePrefs) { /* ignore */ }
    return PAGE_SIZE_DEFAULT;
  }

  function persistPageSize(n) {
    n = clampPageSize(n);
    try {
      sessionStorage.setItem(PAGE_SIZE_SESSION_KEY, String(n));
      localStorage.setItem(PAGE_SIZE_SESSION_KEY, String(n));
    } catch (eStore) { /* ignore */ }
    if (window.DamUserPrefs && typeof window.DamUserPrefs.set === "function") {
      window.DamUserPrefs.set({ branding_page_size: n }).catch(function () {});
    }
    return n;
  }

  /** Draft only — nie przeładowuje siatki (OK stosuje). */
  function syncPageSizeControls(n, opts) {
    opts = opts || {};
    pageSizeDraft = clampPageSize(n);
    var range = document.getElementById("damBrandingPageSizeRange");
    var num = document.getElementById("damBrandingPageSizeInput");
    if (range && String(range.value) !== String(pageSizeDraft)) range.value = String(pageSizeDraft);
    if (num && String(num.value) !== String(pageSizeDraft)) num.value = String(pageSizeDraft);
    var host = document.getElementById("damBrandingPageSize");
    if (host) {
      var dirty = pageSizeDraft !== GRID_LIMIT_TAB;
      host.classList.toggle("is-dirty", dirty);
      if (opts.markApplied) host.classList.remove("is-dirty");
    }
    return pageSizeDraft;
  }

  function applyPageSize(n) {
    GRID_LIMIT_TAB = persistPageSize(n != null ? n : pageSizeDraft);
    syncPageSizeControls(GRID_LIMIT_TAB, { markApplied: true });
    if (typeof renderActiveSection === "function") {
      renderActiveSection();
    }
    return GRID_LIMIT_TAB;
  }

  function bindBrandingPageSizeControl() {
    var range = document.getElementById("damBrandingPageSizeRange");
    var num = document.getElementById("damBrandingPageSizeInput");
    var okBtn = document.getElementById("damBrandingPageSizeOk");
    var host = document.getElementById("damBrandingPageSize");
    if (!host || host._damPageSizeBound) return;
    host._damPageSizeBound = true;

    GRID_LIMIT_TAB = readStoredPageSize();
    pageSizeDraft = GRID_LIMIT_TAB;
    syncPageSizeControls(GRID_LIMIT_TAB, { markApplied: true });

    function onDraft(val) {
      syncPageSizeControls(val);
    }

    if (range) {
      range.addEventListener("input", function () {
        onDraft(this.value);
      });
      /* change bez apply — tylko OK stosuje (bez janku przy drag) */
    }
    if (num) {
      num.addEventListener("input", function () {
        onDraft(this.value);
      });
      num.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          applyPageSize(num.value);
        }
      });
    }
    if (okBtn) {
      okBtn.addEventListener("click", function () {
        applyPageSize(pageSizeDraft);
      });
    }

    host.addEventListener(
      "wheel",
      function (e) {
        if (!host.contains(e.target)) return;
        e.preventDefault();
        var step = e.deltaY > 0 ? -4 : 4;
        onDraft(pageSizeDraft + step);
      },
      { passive: false }
    );

    window.addEventListener("dam:user-prefs", function (ev) {
      var p = ev && ev.detail && ev.detail.prefs;
      if (!p || p.branding_page_size == null) return;
      var next = clampPageSize(p.branding_page_size);
      /* Świeży OK w session/local wygrywa z opóźnioną odpowiedzią KV. */
      try {
        var sess = sessionStorage.getItem(PAGE_SIZE_SESSION_KEY);
        if (sess != null && sess !== "" && clampPageSize(sess) === GRID_LIMIT_TAB && next !== GRID_LIMIT_TAB) {
          return;
        }
      } catch (eRace) { /* ignore */ }
      if (next === GRID_LIMIT_TAB && next === pageSizeDraft) return;
      if (next !== GRID_LIMIT_TAB) {
        GRID_LIMIT_TAB = next;
        syncPageSizeControls(next, { markApplied: true });
        if (typeof renderActiveSection === "function") renderActiveSection();
      } else {
        syncPageSizeControls(next, { markApplied: true });
      }
    });

    if (window.DamUserPrefs && typeof window.DamUserPrefs.load === "function") {
      window.DamUserPrefs.load().then(function (prefs) {
        if (!prefs || prefs.branding_page_size == null) return;
        var next = clampPageSize(prefs.branding_page_size);
        try {
          var sess2 = sessionStorage.getItem(PAGE_SIZE_SESSION_KEY);
          if (sess2 != null && sess2 !== "") next = clampPageSize(sess2);
        } catch (eS2) { /* ignore */ }
        if (next === GRID_LIMIT_TAB) {
          syncPageSizeControls(next, { markApplied: true });
          return;
        }
        GRID_LIMIT_TAB = next;
        syncPageSizeControls(next, { markApplied: true });
        if (typeof renderActiveSection === "function") renderActiveSection();
      });
    }
  }

  function showInitialBootSkeletons() {
    if (!window.DamGridReveal || typeof window.DamGridReveal.skeleton !== "function") return;
    var skelOpts = { variant: "cards", layout: "viz-grid", responsive: true };
    var sectionGrid = document.getElementById("damBrandingSectionGrid");
    var brandbookGrid = document.getElementById("damBrandbookGrid");
    if (sectionGrid && !sectionGrid.querySelector(".dam-viz-card")) {
      sectionGrid.setAttribute("aria-busy", "true");
      if (!sectionGrid.querySelector(".dam-skeleton__card")) {
        window.DamGridReveal.skeleton(sectionGrid, skelOpts);
      }
    }
    if (brandbookGrid && !brandbookGrid.querySelector(".dam-viz-card")) {
      brandbookGrid.setAttribute("aria-busy", "true");
      if (!brandbookGrid.querySelector(".dam-skeleton__card")) {
        window.DamGridReveal.skeleton(brandbookGrid, {
          variant: "cards",
          layout: "viz-grid",
          responsive: true,
        });
      }
    }
  }

  function clearBootSkeletonBusy() {
    var sectionGrid = document.getElementById("damBrandingSectionGrid");
    var brandbookGrid = document.getElementById("damBrandbookGrid");
    if (sectionGrid) sectionGrid.removeAttribute("aria-busy");
    if (brandbookGrid) {
      brandbookGrid.removeAttribute("aria-busy");
      /* Boot skeleton na ukrytym brandbook nie moze zostac po zaladowaniu indeksu. */
      if (
        brandbookGrid.querySelector(".dam-skeleton__card") &&
        !brandbookGrid.querySelector(".dam-viz-card")
      ) {
        brandbookGrid.innerHTML = "";
      }
    }
  }

  /**
   * Wejscie belki meta-filtrow: gora -> dol (opacity + y). Bez clip-path w spoczynku
   * (doktryna IO). prefers-reduced-motion => natychmiast.
   * Start dopiero gdy shell nie trzyma body na opacity:0 (inaczej animacja mija niewidocznie).
   */
  function canRevealMetaFilters() {
    var root = document.documentElement;
    if (root.classList.contains("dam-booting")) return false;
    var body = document.body;
    if (!body) return false;
    try {
      var op = parseFloat(window.getComputedStyle(body).opacity);
      if (!isNaN(op) && op < 0.85) return false;
    } catch (eOp) {
      /* ignore */
    }
    return true;
  }

  function revealMetaFilters() {
    var host = document.querySelector(".dam-branding-filters--meta");
    if (!host || host.getAttribute("data-dam-meta-revealed") === "1") return;
    if (!canRevealMetaFilters()) return false;
    host.setAttribute("data-dam-meta-revealed", "1");
    var kids = Array.prototype.filter.call(host.children, function (el) {
      return el && el.nodeType === 1;
    });
    if (!kids.length) return true;
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return true;
    }
    if (window.DamGridReveal && typeof window.DamGridReveal.revealSequence === "function") {
      window.DamGridReveal.revealSequence(host, kids, {
        mode: "slide",
        stagger: 0.055,
        duration: 0.48,
        y: -12,
      });
    }
    return true;
  }

  function scheduleMetaFiltersReveal() {
    var tries = 0;
    var tick = function () {
      if (revealMetaFilters()) return;
      tries += 1;
      if (tries > 80) return;
      setTimeout(tick, 60);
    };
    if (document.documentElement.classList.contains("dam-booted")) {
      requestAnimationFrame(function () {
        requestAnimationFrame(tick);
      });
      return;
    }
    var obs = null;
    if (typeof MutationObserver === "function") {
      obs = new MutationObserver(function () {
        if (document.documentElement.classList.contains("dam-booted")) {
          if (obs) obs.disconnect();
          requestAnimationFrame(function () {
            requestAnimationFrame(tick);
          });
        }
      });
      obs.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }
    setTimeout(function () {
      if (obs) obs.disconnect();
      tick();
    }, 4800);
  }

  function tryAutoOpenSingleMarketingSearch(qsText) {
    if (!qsText) return;
    var q = String(qsText).trim();
    if (!q) return;
  if (!/(?:^m[-_]?[a-z]{2,8}[-_]?\d{5,6}$)|(?:img\d{5,6})|(?:^br-\d{4,8}$)|(?:^\d{5,7}$)/i.test(q.replace(/\s/g, ""))) {
      return;
    }
    window.requestAnimationFrame(function () {
      setTimeout(function () {
        if (document.getElementById("damMediaPreview")) return;
        var cards = document.querySelectorAll("#damBrandingSectionGrid .dam-branding-card[data-id]");
        if (cards.length !== 1) return;
        var id = cards[0].getAttribute("data-id");
        if (id) openModal(id);
      }, 120);
    });
  }

  async function boot() {
    try {
      showInitialBootSkeletons();
      bindTabs();
      bindFilters();
      bindCategoryHintUi();
      bindBrandingCardZoomControl();
      bindBrandingPageSizeControl();
      scheduleMetaFiltersReveal();
      // Instant: first card z slim; search-index (~41MB) lazy po siatce / on-demand.
      var searchPromise = null;
      performance.mark("dam-branding-boot-start");
      await Promise.all([loadIndex(), loadAssociations(), loadTokens()]);
      clearBootSkeletonBusy();
      performance.mark("dam-branding-index-ready");
      var rebuild = document.getElementById("damBrandingRebuild");
      if (rebuild) {
        var role =
          (window.DamApi && typeof window.DamApi.role === "function" && window.DamApi.role()) ||
          localStorage.getItem("dam_role") ||
          "";
        if (String(role).toLowerCase() !== "admin") {
          rebuild.hidden = true;
          rebuild.setAttribute("aria-hidden", "true");
        } else {
          rebuild.addEventListener("click", async function () {
            rebuild.disabled = true;
            try {
              var headers =
                (window.DamApi && DamApi.authHeaders && DamApi.authHeaders()) || {
                  "Content-Type": "application/json",
                  Authorization: "Bearer " + (localStorage.getItem("dam_token") || ""),
                };
              await fetch(bridgeUrl() + "/branding/rebuild", {
                method: "POST",
                headers: headers,
                body: "{}",
              });
              invalidateBrandingIndexCache();
              await loadIndex();
              await loadCampaigns();
              activateTab(
                document.querySelector(".dam-branding-tab.is-active")?.getAttribute("data-tab") || "all",
                { skipHash: true, keepDiscovery: true }
              );
            } finally {
              rebuild.disabled = false;
            }
          });
        }
      }
      var params = new URLSearchParams(location.search);
      var qs = params.get("q") || params.get("search");
      var productParam = params.get("product");
      var tabParam = params.get("tab");
      var needsSearch =
        !!(qs || productParam) ||
        !!(window.DamProductCorrelation && productParam);
      if (needsSearch) {
        searchPromise = loadSearchIndex();
        await searchPromise;
        if (window.DamProductCorrelation) {
          await DamProductCorrelation.ensureSearchIndex();
          productCorrelation = DamProductCorrelation.resolveFromUrl(productParam, qs);
        }
      } else {
        /* HARD perf: nie ciagnij ~41MB search-index rownolegle z grid hydrate.
           First paint z grid; search dopiero focus/input albo idle ~8-12s. */
        function kickSearchIndex() {
          if (searchPromise) return searchPromise;
          searchPromise = loadSearchIndex().then(function () {
            try {
              performance.mark("dam-branding-search-ready");
              performance.measure(
                "dam-search-index-ms",
                "dam-branding-boot-start",
                "dam-branding-search-ready"
              );
            } catch (eMark) {
              /* ignore */
            }
            renderTagFilters();
          });
          return searchPromise;
        }
        var searchInput = document.getElementById("damBrandingSearch");
        if (searchInput) {
          var onceSearch = function () {
            searchInput.removeEventListener("focus", onceSearch);
            searchInput.removeEventListener("input", onceSearch);
            kickSearchIndex();
          };
          searchInput.addEventListener("focus", onceSearch);
          searchInput.addEventListener("input", onceSearch);
        }
        if (typeof requestIdleCallback === "function") {
          requestIdleCallback(
            function () {
              kickSearchIndex();
            },
            { timeout: 12000 }
          );
        } else {
          setTimeout(function () {
            kickSearchIndex();
          }, 8000);
        }
        try {
          renderTagFilters();
        } catch (eTags) {
          /* ignore */
        }
      }
      if (qs || productParam) {
        var search = document.getElementById("damBrandingSearch");
        if (search) {
          search.value =
            (productCorrelation && productCorrelation.displayQuery) || qs || productParam || "";
        }
      }
      var camp = params.get("campaign");
      if (camp) selectedCampaignId = camp;
      var assetId = params.get("asset");
      var hashTab = tabFromHash();
      var allowedTabs = {
        all: 1,
        packshots: 1,
        www: 1,
        campaigns: 1,
        social: 1,
        brandbook: 1,
      };
      if (camp) {
        activateTab("campaigns", { skipHash: !!hashTab });
      } else if (tabParam && allowedTabs[normalizeTab(tabParam)]) {
        activateTab(normalizeTab(tabParam), { skipHash: true });
      } else if (hashTab) {
        activateTab(hashTab, { skipHash: true });
      } else if (qs) {
        activateTab(bestTabForSearchQuery(qs), { skipHash: true });
      } else {
        activateTab("all", { skipHash: true });
      }
      try {
        performance.mark("dam-branding-first-card");
        performance.measure(
          "dam-cold-ms",
          "dam-branding-boot-start",
          "dam-branding-first-card"
        );
        window.__damInstantMetrics = {
          cold_ms: Math.round(
            (performance.getEntriesByName("dam-cold-ms")[0] || {}).duration || 0
          ),
        };
      } catch (eCold) { /* ignore */ }
      if (assetId) openModal(assetId);
      else if (qs) tryAutoOpenSingleMarketingSearch(qs);
      window.addEventListener("hashchange", function () {
        var t = tabFromHash();
        if (t) activateTab(t, { skipHash: true });
      });
      scheduleMetaFiltersReveal();
    } catch (e) {
      var grid = document.getElementById("damBrandingGrid");
      if (grid) grid.innerHTML = '<p class="dam-branding-muted">Błąd: ' + esc(e.message) + "</p>";
      var sectionGrid = document.getElementById("damBrandingSectionGrid");
      if (sectionGrid) sectionGrid.innerHTML = '<p class="dam-branding-muted">Błąd: ' + esc(e.message) + "</p>";
    }
  }

  function patchAssetField(assetId, field, value) {
    var a = findAssetById(assetId);
    if (!a) return;
    clearBrandingComputeCache();
    if (field === "asset_role") {
      a.asset_role = value;
    } else if (field === "appearance_primary") {
      var tags = (a.appearance_tags || []).slice();
      if (tags.length) tags[0] = value;
      else tags.push(value);
      a.appearance_tags = tags;
    }
    renderTagFilters();
    renderActiveSection();
  }

  window.addEventListener("dam-branding-index-stale", function () {
    clearBrandingComputeCache();
  });

  window.DamBranding = {
    applyBadgeFilter: applyBadgeFilter,
    clearComputeCache: clearBrandingComputeCache,
    invalidateIndexCache: invalidateBrandingIndexCache,
    clearTagFilters: clearTagFilters,
    renderTagFilters: renderTagFilters,
    patchAssetField: patchAssetField,
    openByAssetId: function (id) {
      if (id) openModal(String(id).trim());
    },
    findAssetById: findAssetById,
    marketingGroupLabelForAssets: marketingGroupLabel,
    marketingGroupKey: marketingGroupKey,
    groupMarketingAssets: groupMarketingAssets,
    buildPickerBrowseRows: buildPickerBrowseRows,
    brandingCardDisplayAssets: brandingCardDisplayAssets,
    brandingCardIndexLabels: brandingCardIndexLabels,
  };

  document.addEventListener("DOMContentLoaded", boot);
})();
