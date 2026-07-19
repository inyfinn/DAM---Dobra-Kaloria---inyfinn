(function () {
  "use strict";

  var index = null;
  var tokens = null;
  var campaigns = null;
  var CB = "hub20260719source01";
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
  var GRID_LIMIT_BROWSE = 240;
  var GRID_LIMIT_TAB = 120;
  var CARD_ZOOM_KEY = "dam_viz_card_zoom";
  var CARD_ZOOM_MIN = 50;
  var CARD_ZOOM_MAX = 250;
  var CARD_IMG_BASE_SCALE = 1.2;
  var CARD_BASE_MIN_PX = 220;

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
      return window.DamMediaPreview.previewUrl(path, asset);
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
    return normalizeMediaType(a.media_type) === "image" ||
      normalizeMediaType(a.media_type) === "vector" ||
      normalizeMediaType(a.media_type) === "source" ||
      normalizeMediaType(a.media_type) === "video";
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
    if (kind === "facet") {
      return assetMatchesCanonicalFacet(a, val);
    }
    if (kind === "tag") {
      return (a.tags || []).indexOf(val) !== -1;
    }
    return true;
  }

  function assetMatchesActiveTags(a) {
    var keys = Object.keys(activeTagFilters);
    for (var i = 0; i < keys.length; i++) {
      if (!activeTagFilters[keys[i]]) continue;
      if (!assetMatchesTagKey(a, keys[i])) return false;
    }
    return true;
  }

  function searchTokens(q) {
    var raw = String(q || "")
      .toLowerCase()
      .split(/\s+/)
      .map(function (t) {
        return normTag(t);
      })
      .filter(Boolean);
    if (!raw.length) return [];
    var synonymMap = {
      "bez tla": ["przezroczyste", "transparent", "przezroczyste tlo"],
      "tlo usuniete": ["przezroczyste", "transparent", "przezroczyste tlo"],
      "przezroczyste": ["transparent", "przezroczyste tlo"],
      "przezroczyste tlo": ["transparent"],
      "tlo przezroczyste": ["transparent", "przezroczyste tlo"],
    };
    var out = [];
    var seen = {};
    raw.forEach(function (t) {
      if (!seen[t]) {
        seen[t] = true;
        out.push(t);
      }
      var syns = synonymMap[t];
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
  }

  async function loadSearchIndex() {
    if (searchIndex) return searchIndex;
    searchIndex = { by_tag: {} };
    try {
      var r = await fetch(bridgeUrl() + "/branding-search-index?v=" + CB + "&_=" + Date.now());
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
    { id: "swieta", label: "Święta" },
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
    { id: "swieta25", label: "Święta 2025", when: "swieta", search: "święta", tab: "campaigns" },
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
    campaigns: "Banery i materiały kampanii.",
    social: "Filmy i animacje na social.",
    www: "Slidery i banery strony.",
    packshots: "Zdjęcia opakowań produktów.",
    brandbook: "Logo, kolory i szablony marki.",
  };

  var SECTION_MARKERS = {
    campaigns: /08\s*-\s*KAMAPANIE/i,
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
    if (SECTION_MARKERS.campaigns.test(p)) return "campaigns";
    if (SECTION_MARKERS.social.test(p)) return "social";
    if (SECTION_MARKERS.www.test(p)) return "www";
    if (SECTION_MARKERS.brandbook.test(p)) return "brandbook";
    return "other";
  }

  function assetInSectionTab(a, tab) {
    if (!a || !tab) return false;
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

  function meaningfulFolderLabel(path) {
    var parts = String(path || "")
      .replace(/\\/g, "/")
      .split("/")
      .filter(Boolean);
    parts.pop();
    var depth = 0;
    while (parts.length > 0 && depth < 8 && isTechnicalFolderName(parts[parts.length - 1])) {
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
    var tags = (primary.appearance_tags || []).filter(function (t) {
      return !isGenericAppearanceTag(t);
    });
    if (tags.length) return tags.slice(0, 2).join(" · ");
    var folderLabel = meaningfulFolderLabel(primary.path);
    if (folderLabel && !isTechnicalFolderName(folderLabel) && !isGenericFolderName(folderLabel)) {
      return cleanFolderName(folderLabel);
    }
    var smart = smartTitleFromFilename(primary.name);
    if (smart) return smart;
    var human = humanizeMarketingFilename(primary.name);
    if (human.length > 42) {
      var short = smartTitleFromFilename(primary.name);
      if (short) return short;
      return human.slice(0, 40) + "…";
    }
    return human;
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

  function assetBlobNorm(a) {
    var extra = "";
    if (window.DamAssetTaxonomy && DamAssetTaxonomy.isEffectiveTransparent && DamAssetTaxonomy.isEffectiveTransparent(a)) {
      extra = " przezroczyste transparent bez tla tlo usuniete";
    } else if (
      window.DamAssetTaxonomy &&
      DamAssetTaxonomy.isEffectiveWhite &&
      DamAssetTaxonomy.isEffectiveWhite(a)
    ) {
      extra = " biale tlo white";
    }
    (a.appearance_tags || []).forEach(function (tag) {
      if (window.DamBadges && typeof window.DamBadges.brandingSearchSynonymsForLabel === "function") {
        extra += " " + window.DamBadges.brandingSearchSynonymsForLabel(tag);
      }
    });
    if (a.campaign_id && window.DamBadges && typeof window.DamBadges.brandingSearchSynonymsForLabel === "function") {
      extra += " kampanie kampanie reklamowe " + String(a.campaign_id).replace(/_/g, " ");
    }
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
    var ids = [];
    if (siblings && siblings.length) {
      siblings.forEach(function (x) {
        if (x && x.id) ids.push(x.id);
      });
    } else if (a && a.id) {
      ids.push(a.id);
    }
    return ids;
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

  function brandingCardTitleHtml(displayTitle, subtitleHtml) {
    return (
      '<div class="dam-viz-card__title-wrap">' +
      '<h5 class="dam-viz-card__title" title="' +
      esc(displayTitle) +
      '">' +
      esc(displayTitle) +
      (subtitleHtml || "") +
      "</h5></div>"
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
    if (!q) return true;
    var tokens = searchTokens(q);
    if (!tokens.length) return true;
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
    return tokens.every(function (t) {
      return blob.indexOf(normTag(t)) !== -1;
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
    if (whenId === "swieta") {
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

  function renderDiscoveryPanel(tab) {
    var host = document.getElementById("damBrandingDiscovery");
    if (!host) return;
    var hasFilters = hasActiveDiscoveryFilters();
    if (hasFilters || tab === "brandbook") {
      host.hidden = true;
      return;
    }
    host.hidden = false;

    var recentHost = document.getElementById("damBrandingRecent");
    var recent = readRecentAssets();
    if (recentHost) {
      if (!recent.length) {
        recentHost.hidden = true;
      } else {
        recentHost.hidden = false;
        recentHost.innerHTML =
          '<p class="dam-branding-discovery__label">Ostatnio otwierane</p><div class="dam-branding-recent">' +
          recent
            .slice(0, 8)
            .map(function (a) {
              var label = marketingGroupLabel([a]);
              if (label.length > 28) label = label.slice(0, 26) + "…";
              return (
                '<button type="button" class="dam-branding-recent__item" data-id="' +
                esc(a.id) +
                '">' +
                recentThumbHtml(a) +
                "<span>" +
                esc(label) +
                "</span></button>"
              );
            })
            .join("") +
          "</div>";
        recentHost.querySelectorAll(".dam-branding-recent__item").forEach(function (btn) {
          btn.addEventListener("click", function () {
            openModal(btn.getAttribute("data-id"));
          });
        });
      }
    }
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
    return (btn && btn.getAttribute("data-tab")) || "campaigns";
  }

  function renderActiveSection() {
    try {
      var tab = currentSectionTab();
    var sectionPanel = document.getElementById("damBrandingPanelSection");
    var brandbookPanel = document.getElementById("damBrandingPanelBrandbook");
    if (sectionPanel) sectionPanel.hidden = tab === "brandbook";
    if (brandbookPanel) brandbookPanel.hidden = tab !== "brandbook";

    if (tab === "brandbook") {
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
  var tagFilterExpanded = {};

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
    groups.produkt = [];
    chips.forEach(function (c) {
      var g = c.group || "produkt";
      if (!groups[g]) groups[g] = [];
      groups[g].push(c);
    });
    [
      "marka",
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
    var facetCounts = computeFacetCounts(allChipKeys, sectionTab);
    var globalFacetCounts = computeFacetCounts(allChipKeys, sectionTab, { global: true });
    var showCounts = showTagCounts();
    var activeMap = buildAssocActiveMap();
    var buildRow = window.DamTagBar && DamTagBar.buildGroupRow;
    var html = '<div class="dam-tag-groups__inner">';
    GROUP_ORDER.forEach(function (g) {
      if (!groups[g] || !groups[g].length || !buildRow) return;
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
          var countHtml = showCounts
            ? ' <span class="dam-tag-count" aria-hidden="true">(' + cnt + ")</span>"
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

    host.querySelectorAll(".dam-viz-badge[data-tag-key]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-tag-key") || "";
        if (!key) return;
        if (/^(search:|when:|collection:|co:)/.test(key)) {
          handleAssocChipClick(key);
          return;
        }
        var tabSwitch = "";
        if (activeTagFilters[key]) delete activeTagFilters[key];
        else {
          activeTagFilters[key] = true;
          tabSwitch = tabForFacetKey(key);
          if (!tabSwitch && (computeFacetCounts([key], currentSectionTab())[key] || 0) === 0) {
            tabSwitch = bestTabForTagKey(key);
          }
          if (key.indexOf("facet:") === 0) setSearchQuery("");
        }
        renderTagFilters();
        if (tabSwitch) {
          activateTab(tabSwitch, { skipHash: true, keepDiscovery: true });
        } else {
          renderActiveSection();
        }
      });
    });
  }

  window.__damBrandingThumbFallback = function (img) {
    if (!img) return;
    if (img.dataset.fallbackTried === "1") {
      img.classList.add("dam-viz-thumb__img--placeholder");
      img.onerror = null;
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
    img.classList.add("dam-viz-thumb__img--placeholder");
  };

  window.__damBrandingVideoThumbFallback = function (vid) {
    if (!vid) return;
    var wrap = vid.closest(".dam-branding-thumb__video-wrap");
    if (!wrap) return;
    var tried = Number(wrap.dataset.streamTry || "0");
    var path = wrap.getAttribute("data-path") || vid.getAttribute("data-path") || "";
    if (tried < 1 && path) {
      wrap.dataset.streamTry = "1";
      vid.removeAttribute("poster");
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
    if (index) return index;
    setBootStatus("Ładowanie indeksu branding…");
    var urls = [
      "data/branding-index.json?v=" + CB + "&_=" + Date.now(),
      bridgeUrl() + "/branding-index?v=" + CB + "&_=" + Date.now(),
    ];
    var lastErr = null;
    for (var u = 0; u < urls.length; u++) {
      try {
        var r = await fetch(urls[u]);
        if (!r.ok) continue;
        setBootStatus("Przetwarzanie indeksu…");
        index = await r.json();
        return index;
      } catch (eLoad) {
        lastErr = eLoad;
      }
    }
    throw lastErr || new Error("branding-index");
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

    var list = (index.assets || []).filter(function (a) {
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
      if (graphicsOnlyActive() && !activeTagFilters["media:document"] && a.media_type === "document") {
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

  function computeFacetCounts(chipKeys, sectionTab, opts) {
    opts = opts || {};
    var counts = {};
    var i;
    for (i = 0; i < chipKeys.length; i++) counts[chipKeys[i]] = 0;
    if (!index || !index.assets || !chipKeys.length) return counts;
    var activeKeys = Object.keys(activeTagFilters).filter(function (k) {
      return !!activeTagFilters[k];
    });
    var q = elVal("damBrandingSearch").toLowerCase();
    var tab = opts.global ? "" : sectionTab || currentSectionTab();
    var assets = index.assets;
    for (i = 0; i < assets.length; i++) {
      var a = assets[i];
      if (!includeArchive() && isArchived(a)) continue;
      if (!assetMatchesDateRange(a)) continue;
      if (tab && !assetInSectionTab(a, tab)) continue;
      if (graphicsOnlyActive() && !activeTagFilters["media:document"] && a.media_type === "document") {
        continue;
      }
      if (q && !assetMatchesSearchQuery(a, q)) continue;
      var match = {};
      var k;
      for (k = 0; k < chipKeys.length; k++) {
        match[chipKeys[k]] = assetMatchesTagKey(a, chipKeys[k]);
      }
      for (k = 0; k < chipKeys.length; k++) {
        var key = chipKeys[k];
        var ok = true;
        for (var j = 0; j < activeKeys.length; j++) {
          if (activeKeys[j] === key) continue;
          if (!assetMatchesTagKey(a, activeKeys[j])) {
            ok = false;
            break;
          }
        }
        if (ok && match[key]) counts[key] += 1;
      }
    }
    return counts;
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
    if (a && a.id) {
      var displayId = marketingDisplayId(a);
      html +=
        '<span class="dam-viz-badge dam-viz-badge--index dam-branding-id-chip" data-tag-value="' +
        esc(a.id) +
        '" data-marketing-id="' +
        esc(displayId) +
        '" title="ID marketingowe: ' +
        esc(displayId) +
        '">' +
        esc(displayId) +
        "</span>";
    }
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
      return (
        '<div class="dam-branding-thumb__video-wrap" data-path="' +
        esc(path) +
        '">' +
        '<video class="dam-viz-thumb__img dam-branding-thumb__video-el" muted playsinline preload="metadata" ' +
        'data-path="' +
        esc(path) +
        '" poster="' +
        esc(poster) +
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
    var title = cardOpts.title || a.name;
    var meta = cardOpts.meta != null ? cardOpts.meta : hint || a.sku || "Kliknij kartę · podgląd";
    var thumbAsset = pickPrimaryMarketing(siblings && siblings.length ? siblings : [a]) || a;
    var tileCls =
      window.DamBadges && typeof window.DamBadges.brandingGradientTileClass === "function"
        ? window.DamBadges.brandingGradientTileClass(a)
        : "";
    var groupIds =
      siblings && siblings.length > 1
        ? siblings
            .map(function (x) {
              return x.id;
            })
            .join(",")
        : "";
    var displayTitle = cardOpts.title || a.name;
    var metaLine = cardOpts.meta != null ? cardOpts.meta : brandingCardTypeMeta(a);
    return (
      '<article class="dam-viz-card dam-branding-card dam-viz-card--clickable' +
      (tileCls ? " " + tileCls : "") +
      '" data-id="' +
      esc(a.id) +
      '"' +
      (groupIds ? ' data-group-ids="' + esc(groupIds) + '"' : "") +
      ' title="Kliknij, aby otworzyć podgląd">' +
      '<div class="dam-viz-thumb">' +
      thumbHtml(thumbAsset) +
      "</div>" +
      '<div class="dam-viz-card__body">' +
      '<div class="dam-viz-card__badges">' +
      badgesHtml(a) +
      "</div>" +
      brandingCardTitleHtml(displayTitle, brandingCardSubtitle(a, displayTitle)) +
      brandingCardMetaHtml(metaLine || hint || a.sku || "Materiał", metaAssetIdsForCard(a, siblings)) +
      brandingCardActionsHtml(a) +
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
    var variantLabel =
      assets.length + (isKv ? " wizualizacji" : isProject ? " plików" : " wariantów");
    var meta = isKv
      ? keyVisualGroupMeta(assets)
      : isProject
        ? marketingGroupMeta(assets)
        : hint || "Warianty logo · kliknij kartę";
    var cardTitle = isProject
      ? "Kliknij, aby przejrzeć pliki projektu"
      : isKv
        ? "Kliknij, aby przejrzeć wizualizacje produktu"
        : "Kliknij, aby przejrzeć warianty logo";
    var groupTitle = entry.label || primary.name;
    var groupMeta = meta || brandingCardTypeMeta(primary);
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
      thumbStackHtml(assets, primary) +
      "</div>" +
      '<div class="dam-viz-card__body">' +
      '<div class="dam-viz-card__badges">' +
      badgesHtml(primary, [variantLabel]) +
      "</div>" +
      brandingCardTitleHtml(groupTitle, brandingCardSubtitle(primary, groupTitle)) +
      brandingCardMetaHtml(groupMeta, metaAssetIdsForCard(primary, assets)) +
      brandingCardActionsHtml(primary) +
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

  function setStatusEl(el, groupedSlice, assetTotal, limit) {
    if (!el) return;
    var built = index && index.built_at ? String(index.built_at).slice(0, 19).replace("T", " ") : "";
    var meta = "";
    if (index && index.wizki_count != null) meta += " · WIZKI " + index.wizki_count;
    if (index && index.perspective_count != null) meta += " · perspektywy " + index.perspective_count;
    var cardN = (groupedSlice || []).length;
    var assetN = assetTotal || 0;
    var countLine =
      cardN !== assetN ? cardN + " kart · " + assetN + " assetów" : cardN + " z " + assetN + " assetów";
    el.textContent =
      countLine +
      (built ? " · indeks " + built : "") +
      meta +
      (cardN >= limit ? " · pokazano max " + limit + " kart" : "") +
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

  function emptyGridMessage(defaultMsg, totalBeforeLimit) {
    if (totalBeforeLimit > 0) {
      return (
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
    return (
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
    currentGridAssets = [];
    slice.forEach(function (entry) {
      (entry.assets || []).forEach(function (a) {
        currentGridAssets.push(a);
      });
    });
    if (window.DamBadges && typeof window.DamBadges.bindClicks === "function") {
      window.DamBadges.bindClicks(grid, "branding");
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
            var asset = (index.assets || []).find(function (a) {
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
    return "Plik";
  }

  function buildBrandingGroupContext(primary, assetsById, optSiblings) {
    var variants = (primary && primary.folder_variants) || [];
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

    if (!editable.length && primary && primary.folder_has_editable) {
      Object.keys(assetsById || {}).forEach(function (id) {
        var x = assetsById[id];
        if (!x || !/\.(psd|psb|ai|eps|indd)$/i.test(x.name || "")) return;
        if ((x.folder_group_id || folderDirFromPath(x.path)) !== groupId) return;
        editable.push({ id: x.id, name: x.name, path: x.path });
      });
    }

    return {
      variants: variants || [],
      linked_products: linked || [],
      folder_group_id: groupId || "",
      folder_editable_files: editable || [],
    };
  }

  function openModal(id, siblings) {
    var assetsById = {};
    (index.assets || []).forEach(function (a) {
      assetsById[a.id] = a;
    });
    var primary = assetsById[id];
    if (!primary) return;

    var list = [];
    if (siblings && siblings.length > 1) {
      list = siblings.filter(Boolean);
    }
    if (!list.length && primary.folder_variants && primary.folder_variants.length) {
      primary.folder_variants.forEach(function (v) {
        if (v.id && assetsById[v.id]) list.push(assetsById[v.id]);
      });
    }
    if (!list.length) list = [primary];

    var groupContext = buildBrandingGroupContext(primary, assetsById, list.length > 1 ? list : null);
    if (list.length <= 1 && groupContext.variants && groupContext.variants.length > 1) {
      list = groupContext.variants
        .map(function (v) {
          return v.id && assetsById[v.id];
        })
        .filter(Boolean);
      groupContext = buildBrandingGroupContext(primary, assetsById, list);
    }

    var idx = list.findIndex(function (x) {
      return x.id === id;
    });
    var a = list[idx >= 0 ? idx : 0];
    if (!a) return;
    trackRecentAsset(a);
    if (window.DamMediaPreview && typeof window.DamMediaPreview.openAsset === "function") {
      window.DamMediaPreview.openAsset(a, {
        siblings: list,
        index: idx >= 0 ? idx : 0,
        alwaysShowAssociations: true,
        groupContext: groupContext,
      });
    }
  }

  function closeModal() {
    var modal = document.getElementById("damMediaPreview");
    if (modal) modal.remove();
  }

  function getCampaignList() {
    var list = (campaigns && campaigns.campaigns) || [];
    if (!list.length) {
      var map = {};
      (index.assets || []).forEach(function (a) {
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
      browse: "campaigns",
      przegladaj: "campaigns",
    };
    return map[h] || null;
  }

  function hashForTab(tab) {
    var map = {
      campaigns: "kampanie",
      social: "social",
      www: "www",
      packshots: "packshoty",
      brandbook: "brandbook",
    };
    return map[tab] || tab;
  }

  function normalizeTab(tab) {
    if (tab === "browse" || tab === "layout") return "campaigns";
    if (tab === "keyvisuale") return "packshots";
    if (tab === "channels") return "social";
    return tab || "campaigns";
  }

  function activateTab(tab, opts) {
    opts = opts || {};
    tab = normalizeTab(tab);
    if (!opts.keepDiscovery) {
      discoveryWhen = "";
    }
    document.querySelectorAll(".dam-branding-tab").forEach(function (b) {
      var on = b.getAttribute("data-tab") === tab;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    renderTagFilters();
    if (!opts.skipHash) {
      var nextHash = "#" + hashForTab(tab);
      if (location.hash !== nextHash) {
        history.replaceState(null, "", nextHash);
      }
    }
    renderActiveSection();
  }

  function bindTabs() {
    document.querySelectorAll(".dam-branding-tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        activateTab(btn.getAttribute("data-tab") || "campaigns");
      });
    });
  }

  function bindFilters() {
    ["damBrandingSearch", "damBrandingGraphicsOnly", "damBrandingDateFrom", "damBrandingDateTo", "damBrandingSort"].forEach(
      function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        var handler = function () {
          if (id === "damBrandingDateFrom" || id === "damBrandingDateTo") {
            datePresetActive = "";
            syncDatePresetButtons();
          }
          renderTagFilters();
          renderActiveSection();
        };
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
    return n;
  }

  function bindBrandingCardZoomControl() {
    var input = document.getElementById("damBrandingCardZoom");
    if (!input || input._damZoomBound) return;
    input._damZoomBound = true;
    var saved = parseInt(localStorage.getItem(CARD_ZOOM_KEY) || "100", 10);
    if (isNaN(saved)) saved = 100;
    applyBrandingCardZoom(saved);
    input.addEventListener("input", function () {
      applyBrandingCardZoom(this.value);
    });
    input.addEventListener("change", function () {
      applyBrandingCardZoom(this.value);
    });
  }

  async function boot() {
    try {
      bindTabs();
      bindFilters();
      bindBrandingCardZoomControl();
      var searchPromise = loadSearchIndex();
      await Promise.all([loadIndex(), loadAssociations(), loadTokens()]);
      renderTagFilters();
      var rebuild = document.getElementById("damBrandingRebuild");
      if (rebuild) {
        rebuild.addEventListener("click", async function () {
          rebuild.disabled = true;
          try {
            await fetch(bridgeUrl() + "/branding/rebuild", { method: "POST" });
            index = null;
            campaigns = null;
            campaignAssetMap = {};
            await loadIndex();
            await loadCampaigns();
            activateTab(
              document.querySelector(".dam-branding-tab.is-active")?.getAttribute("data-tab") || "campaigns",
              { skipHash: true, keepDiscovery: true }
            );
          } finally {
            rebuild.disabled = false;
          }
        });
      }
      var params = new URLSearchParams(location.search);
      var qs = params.get("q");
      var productParam = params.get("product");
      await searchPromise;
      if (window.DamProductCorrelation) {
        await DamProductCorrelation.ensureSearchIndex();
        productCorrelation = DamProductCorrelation.resolveFromUrl(productParam, qs);
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
      if (camp) {
        activateTab("campaigns", { skipHash: !!hashTab });
      } else if (hashTab) {
        activateTab(hashTab, { skipHash: true });
      } else {
        activateTab("campaigns", { skipHash: true });
      }
      if (assetId) openModal(assetId);
      window.addEventListener("hashchange", function () {
        var t = tabFromHash();
        if (t) activateTab(t, { skipHash: true });
      });
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

  window.DamBranding = {
    applyBadgeFilter: applyBadgeFilter,
    clearTagFilters: clearTagFilters,
    renderTagFilters: renderTagFilters,
    patchAssetField: patchAssetField,
  };

  document.addEventListener("DOMContentLoaded", boot);
})();
