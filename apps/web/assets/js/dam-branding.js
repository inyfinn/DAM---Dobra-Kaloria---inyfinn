(function () {
  "use strict";

  var index = null;
  var tokens = null;
  var campaigns = null;
  var CB = "hub20260719disc3";
  var selectedCampaignId = null;
  var selectedChannel = "";
  var discoveryWhen = "";
  var associations = null;
  var RECENT_KEY = "dam_branding_recent";
  var campaignAssetMap = {};
  var currentGridAssets = [];
  var searchIndex = null;
  var activeTagFilters = {};
  var GRID_LIMIT_BROWSE = 240;
  var GRID_LIMIT_TAB = 120;

  var FACET_CHIPS = [
    { key: "media:image", label: "Obraz", group: "format_pliku" },
    { key: "media:vector", label: "Wektor", group: "format_pliku" },
    { key: "media:video", label: "Wideo", group: "format_pliku" },
    { key: "media:source", label: "Źródło", group: "format_pliku" },
    { key: "media:document", label: "Dokument", group: "format_pliku" },
    { key: "format:raster", label: "Raster", group: "cechy" },
    { key: "format:transparent", label: "Tło przezroczyste", group: "cechy" },
    { key: "format:white", label: "Tło białe", group: "cechy" },
    { key: "format:editable", label: "Edytowalny", group: "cechy" },
    { key: "appearance:slidery", label: "Slidery", group: "przeznaczenie" },
    { key: "appearance:na sklep", label: "Na sklep", group: "przeznaczenie" },
    { key: "appearance:desktop", label: "Desktop", group: "cechy" },
    { key: "appearance:tablet", label: "Tablet", group: "cechy" },
    { key: "appearance:mobile", label: "Mobile", group: "cechy" },
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
    "Slidery",
    "Na sklep",
  ];

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
    return !!(
      elVal("damBrandingSearch") ||
      discoveryWhen ||
      Object.keys(activeTagFilters).length
    );
  }

  function clearAllBrandingFilters() {
    var search = document.getElementById("damBrandingSearch");
    if (search) search.value = "";
    discoveryWhen = "";
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
    return String(q || "")
      .toLowerCase()
      .split(/\s+/)
      .map(function (t) {
        return normTag(t);
      })
      .filter(Boolean);
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
        return x.i - y.i;
      })
      .map(function (row) {
        return row.a;
      });
  }

  async function loadSearchIndex() {
    if (searchIndex) return searchIndex;
    try {
      var r = await fetch("data/branding-search-index.json?v=" + CB);
      if (r.ok) searchIndex = await r.json();
    } catch (eIdx) {
      searchIndex = { by_tag: {} };
    }
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
    renderActiveSection();
  }

  var FILTER_BADGE_CLASS = {
    format_pliku: "dam-viz-badge--carrier",
    przeznaczenie: "dam-viz-badge--cat",
    cechy: "dam-viz-badge--lang",
    wizualizacja: "dam-viz-badge--subcat",
    kanal: "dam-viz-badge--lang",
    marka: "dam-viz-badge--brand",
    produkt: "dam-viz-badge--subcat",
  };

  var FILTER_GROUP_LABELS = {
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
  ];

  var WHEN_CHIPS = [
    { id: "2026", label: "2026" },
    { id: "2025", label: "2025" },
    { id: "grill", label: "Grill / lato" },
    { id: "swieta", label: "Święta" },
    { id: "wielkanoc", label: "Wielkanoc" },
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
  ];

  var CURATED_COLLECTIONS = [
    { id: "grill26", label: "Grill 2026", when: "2026", search: "grill", tab: "campaigns" },
    { id: "proteina", label: "Proteina — wszystko", search: "proteina" },
    { id: "socialfilm", label: "Filmy social", tab: "social", media: "video" },
    { id: "slidery", label: "Slidery sklepu", tab: "www", appearance: "Slidery" },
    { id: "packshoty", label: "Packshoty produktów", tab: "packshots" },
  ];

  var SECTION_DESCS = {
    campaigns: "Kampanie i materiały promocyjne — szukaj po temacie (grill, przekąski, JUSTTAG), nie po folderze DV360_GIFF.",
    social: "Filmy i animacje na social — wpisz „parówka”, „baton”, „plansza końcowa” albo kliknij Wideo u góry.",
    www: "Slidery i banery strony — np. „niemięsa”, „promocja 5 zł”, „slider”.",
    packshots: "Wizualizacje opakowań — jedna karta = produkt (jak Wizualizacje). Kliknij miniaturę smaku albo wpisz nazwę.",
    brandbook: "Logo, kolory i szablony marki.",
  };

  var SECTION_MARKERS = {
    campaigns: /08\s*-\s*KAMAPANIE/i,
    social: /05\s*-\s*SOCIAL\s*MEDIA/i,
    www: /06\s*-\s*STRONY\s*WWW/i,
    brandbook: /BRANDING\s*I\s*MARKA|BRANDBOOK|BRAND\s*BOOK/i,
  };

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

  function marketingGroupLabel(assets) {
    var primary = pickPrimaryMarketing(assets) || assets[0];
    if (!primary) return "Materiał";
    var tags = (primary.appearance_tags || []).filter(function (t) {
      var k = normTag(t);
      return k && k.length > 2 && !/^(kampanie|marketing|wideo|grafika|baner|slider)$/.test(k);
    });
    if (tags.length) return tags.slice(0, 2).join(" · ");
    var folderLabel = meaningfulFolderLabel(primary.path);
    if (folderLabel && !isTechnicalFolderName(folderLabel)) {
      return cleanFolderName(folderLabel);
    }
    return humanizeMarketingFilename(primary.name);
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
    return normTag(
      (a.search_blob || "") +
        " " +
        (a.name || "") +
        " " +
        (a.appearance_tags || []).join(" ") +
        " " +
        (a.campaign_id || "")
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
    var tokens = searchTokens(q);
    if (!tokens.length) return true;
    var blob = assetBlobNorm(a);
    var assocPids = associationProductIdsForTokens(tokens);
    if (assocPids.length && (a.linked_product_ids || []).some(function (pid) { return assocPids.indexOf(pid) !== -1; })) {
      return true;
    }
    var byTag = (searchIndex && searchIndex.by_tag) || {};
    tokens.forEach(function (t) {
      var nt = normTag(t);
      Object.keys(byTag).forEach(function (tag) {
        if (normTag(tag).indexOf(nt) !== -1 && byTag[tag].indexOf(a.id) !== -1) {
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
    renderActiveSection();
  }

  function applyCollection(col) {
    if (!col) return;
    setSearchQuery(col.search || "");
    discoveryWhen = col.when || "";
    if (col.tab) activateTab(col.tab, { skipHash: true, keepDiscovery: true });
    if (col.appearance) {
      activeTagFilters = {};
      activeTagFilters[appearanceKey(col.appearance)] = true;
    } else if (col.media) {
      activeTagFilters = {};
      activeTagFilters["media:" + col.media] = true;
    }
    renderTagFilters();
    renderActiveSection();
  }

  function renderContextBar() {
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
        renderActiveSection();
      }});
    }
    if (discoveryWhen) {
      var whenLbl = (WHEN_CHIPS.filter(function (w) { return w.id === discoveryWhen; })[0] || {}).label || discoveryWhen;
      chips.push({ kind: "when", label: "Kiedy: " + whenLbl, remove: function () {
        discoveryWhen = "";
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
                '"><img src="' +
                esc(mediaUrl(a.path, a)) +
                '" alt="" loading="lazy" /><span>' +
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

    var quickHost = document.getElementById("damBrandingQuickAssoc");
    if (quickHost) {
      quickHost.innerHTML =
        '<p class="dam-branding-discovery__label">Szybkie skojarzenia</p><div class="dam-branding-discovery__chips">' +
        QUICK_ASSOCIATIONS.map(function (term) {
          return (
            '<button type="button" class="dam-branding-discovery-chip" data-q="' +
            esc(term) +
            '">' +
            esc(term.charAt(0).toUpperCase() + term.slice(1)) +
            "</button>"
          );
        }).join("") +
        "</div>";
      quickHost.querySelectorAll("[data-q]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          applyQuickSearch(btn.getAttribute("data-q") || "");
        });
      });
    }

    var whenHost = document.getElementById("damBrandingWhen");
    if (whenHost) {
      whenHost.innerHTML =
        '<p class="dam-branding-discovery__label">Kiedy</p><div class="dam-branding-discovery__chips">' +
        WHEN_CHIPS.map(function (w) {
          return (
            '<button type="button" class="dam-branding-discovery-chip' +
            (discoveryWhen === w.id ? " is-active" : "") +
            '" data-when="' +
            esc(w.id) +
            '">' +
            esc(w.label) +
            "</button>"
          );
        }).join("") +
        "</div>";
      whenHost.querySelectorAll("[data-when]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var id = btn.getAttribute("data-when") || "";
          discoveryWhen = discoveryWhen === id ? "" : id;
          renderActiveSection();
        });
      });
    }

    var colHost = document.getElementById("damBrandingCollections");
    if (colHost) {
      colHost.innerHTML =
        '<p class="dam-branding-discovery__label">Kolekcje</p><div class="dam-branding-discovery__chips">' +
        CURATED_COLLECTIONS.map(function (c) {
          return (
            '<button type="button" class="dam-branding-discovery-chip" data-col="' +
            esc(c.id) +
            '">' +
            esc(c.label) +
            "</button>"
          );
        }).join("") +
        "</div>";
      colHost.querySelectorAll("[data-col]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var id = btn.getAttribute("data-col");
          var col = CURATED_COLLECTIONS.filter(function (c) {
            return c.id === id;
          })[0];
          applyCollection(col);
        });
      });
    }

    var whatHost = document.getElementById("damBrandingWhat");
    if (whatHost) {
      whatHost.innerHTML =
        '<p class="dam-branding-discovery__label">Co (produkt)</p><div class="dam-branding-discovery__tiles">' +
        WHAT_TILES.map(function (tile) {
          var sample = findThumbForTile(tile);
          var thumb = sample
            ? '<img class="dam-branding-discovery-tile__thumb" src="' +
              esc(mediaUrl(sample.path, sample)) +
              '" alt="" loading="lazy" />'
            : '<div class="dam-branding-discovery-tile__thumb"></div>';
          return (
            '<button type="button" class="dam-branding-discovery-tile" data-q="' +
            esc(tile.search || tile.appearance || tile.label) +
            '">' +
            thumb +
            '<span class="dam-branding-discovery-tile__label">' +
            esc(tile.label) +
            "</span></button>"
          );
        }).join("") +
        "</div>";
      whatHost.querySelectorAll(".dam-branding-discovery-tile").forEach(function (btn) {
        btn.addEventListener("click", function () {
          applyQuickSearch(btn.getAttribute("data-q") || "");
        });
      });
    }
  }

  function assetsForSectionTab(tab) {
    var all = filteredAssets({
      keyVisuale: tab === "packshots",
      brandbookOnly: tab === "brandbook",
    });
    if (tab === "packshots") {
      all = all.filter(function (a) {
        return a.perspective && (a.size === "XL" || a.size === "L" || a.size === "S" || a.size === "S_SKLEP");
      });
      return all;
    }
    if (tab === "brandbook") return all;
    return all.filter(function (a) {
      return assetSectionId(a) === tab;
    });
  }

  function filterByDiscovery(list) {
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
    renderContextBar();
    renderDiscoveryPanel(tab);
    var list = filterByDiscovery(sectionAll);

    var gridOpts = { groupMode: tab === "packshots" ? "keyvisuale" : "project" };
    var grid = document.getElementById("damBrandingSectionGrid");
    var emptyMsg = elVal("damBrandingSearch")
      ? "Brak wyników dla tego wyszukiwania — spróbuj innego skojarzenia (burger, grill, proteina)."
      : "Brak materiałów — zmień filtr „Kiedy”, tag u góry albo wpisz słowo kluczowe.";
    var shown = renderAssetGrid(grid, list, GRID_LIMIT_TAB, emptyMsg, sectionAll.length, gridOpts);
    setStatusEl(document.getElementById("damBrandingStatus"), shown, list.length, GRID_LIMIT_TAB);
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
    var base = PRODUCT_TAG_CHIPS.slice();
    var seen = {};
    base.forEach(function (l) {
      seen[normTag(l)] = true;
    });
    var byTag = (searchIndex && (searchIndex.by_appearance || searchIndex.by_tag)) || {};
    var ranked = Object.keys(byTag)
      .map(function (label) {
        return { label: label, n: (byTag[label] || []).length };
      })
      .filter(function (row) {
        if (row.n < 6) return false;
        if (!isProductChipLabel(row.label)) return false;
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
    var groups = {
      format_pliku: [],
      przeznaczenie: [],
      cechy: [],
      wizualizacja: [],
      kanal: [],
      marka: [],
      produkt: [],
    };
    chips.forEach(function (c) {
      var g = c.group || "produkt";
      if (!groups[g]) groups[g] = [];
      groups[g].push(c);
    });
    var GROUP_ORDER = [
      "format_pliku",
      "przeznaczenie",
      "cechy",
      "wizualizacja",
      "kanal",
      "marka",
      "produkt",
    ];
    var buildRow = window.DamTagBar && DamTagBar.buildGroupRow;
    var html = '<div class="dam-tag-groups__inner">';
    GROUP_ORDER.forEach(function (g) {
      if (!groups[g] || !groups[g].length || !buildRow) return;
      html += buildRow({
        groupKey: g,
        label: FILTER_GROUP_LABELS[g] || g,
        className: "dam-branding-tag-group--" + g,
        chips: groups[g].map(function (c) {
          return { key: c.key, label: c.label };
        }),
        activeMap: activeTagFilters,
        expandedGroups: tagFilterExpanded,
        rowLimit: TAG_FILTER_ROW_LIMIT,
        pillHtml: function (chip, active) {
          var badgeCls = FILTER_BADGE_CLASS[g] || "dam-viz-badge--subcat";
          return (
            '<button type="button" class="dam-viz-badge dam-badge-tag ' +
            badgeCls +
            (active ? " is-active" : "") +
            '" data-tag-key="' +
            esc(chip.key) +
            '" aria-pressed="' +
            (active ? "true" : "false") +
            '">' +
            esc(chip.label) +
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
        if (activeTagFilters[key]) delete activeTagFilters[key];
        else activeTagFilters[key] = true;
        renderTagFilters();
        renderActiveSection();
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
    if (!wrap || wrap.dataset.fallbackDone === "1") return;
    wrap.dataset.fallbackDone = "1";
    wrap.innerHTML =
      '<div class="dam-viz-thumb__noviz dam-branding-thumb__icon">' +
      '<i class="uil uil-play-circle" aria-hidden="true"></i><span>Wideo</span></div>';
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
    var r = await fetch("data/branding-index.json?v=" + CB + "&_=" + Date.now());
    if (!r.ok) throw new Error("branding-index.json");
    index = await r.json();
    return index;
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

    var list = (index.assets || []).filter(function (a) {
      if (!includeArchive() && isArchived(a)) return false;
      if (!assetMatchesActiveTags(a)) return false;
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
    return sortByRelevance(list, q);
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
    if (key === "www" && (p.indexOf("STRONY WWW") !== -1 || p.indexOf("E-COMMERCE") !== -1)) return true;
    if (key === "meta" && p.indexOf("SOCIAL") !== -1) return true;
    if (key === "instagram" && p.indexOf("SOCIAL") !== -1) return true;
    if (key === "google" && p.indexOf("GOOGLE") !== -1) return true;
    return (a.search_blob || "").toLowerCase().indexOf(key) !== -1;
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
      var poster = mediaUrl(path, a);
      var stream = rawMediaUrl(path);
      return (
        '<div class="dam-branding-thumb__video-wrap">' +
        '<video class="dam-viz-thumb__img dam-branding-thumb__video-el" muted playsinline preload="metadata" ' +
        'poster="' +
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
      '<h5 class="dam-viz-card__title" title="' +
      esc(title) +
      '">' +
      esc(title) +
      "</h5>" +
      '<p class="dam-viz-card__meta' +
      (meta ? "" : " dam-viz-card__meta--empty") +
      '">' +
      esc(meta) +
      "</p>" +
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
      '<h5 class="dam-viz-card__title" title="' +
      esc(entry.label || primary.name) +
      '">' +
      esc(entry.label || primary.name) +
      "</h5>" +
      '<p class="dam-viz-card__meta' +
      (meta ? "" : " dam-viz-card__meta--empty") +
      '">' +
      esc(meta) +
      "</p>" +
      "</div></article>"
    );
  }

  function gridEntryHtml(entry, gridOpts) {
    gridOpts = gridOpts || {};
    if (entry.type === "group") return groupCardHtml(entry, gridOpts);
    var a = entry.assets[0];
    if (gridOpts.groupMode === "keyvisuale") {
      return cardHtml(a, entry.assets, {
        title: keyVisualGroupLabel([a]),
        meta: keyVisualGroupMeta([a]) || folderHint(a.path) || a.sku,
      });
    }
    if (gridOpts.groupMode === "project") {
      return cardHtml(a, entry.assets, {
        title: marketingGroupLabel([a]),
        meta: marketingGroupMeta([a]) || folderHint(a.path),
      });
    }
    return cardHtml(a, entry.assets);
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

  function emptyGridMessage(defaultMsg, totalBeforeLimit) {
    if (totalBeforeLimit > 0) return esc(defaultMsg);
    var hint = activeFilterHint();
    if (!hint) return esc(defaultMsg);
    return (
      "Brak wyników przy aktywnym filtrze." +
      esc(hint) +
      ' <button type="button" class="dam-branding-clear-filters">Wyczyść filtry</button>'
    );
  }

  function renderAssetGrid(grid, list, limit, emptyMsg, totalCount, gridOpts) {
    if (!grid) return;
    gridOpts = gridOpts || {};
    var grouped = groupBrandingAssets(list, gridOpts);
    var slice = grouped.slice(0, limit);
    var total = totalCount != null ? totalCount : list.length;
    grid.innerHTML = slice.length
      ? slice
          .map(function (entry) {
            return gridEntryHtml(entry, gridOpts);
          })
          .join("")
      : '<p class="dam-branding-muted">' + emptyGridMessage(emptyMsg || "Brak wyników dla wybranych filtrów.", total) + "</p>";
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

  function bindCards(grid) {
    grid.querySelectorAll(".dam-branding-card").forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        if (ev.target.closest(".dam-viz-badge")) return;
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
  }

  function openModal(id, siblings) {
    var list =
      siblings && siblings.length
        ? siblings
        : currentGridAssets.length
          ? currentGridAssets
          : (index.assets || []).filter(function (x) {
              return x.id === id;
            });
    var idx = list.findIndex(function (x) {
      return x.id === id;
    });
    var a = list[idx >= 0 ? idx : 0];
    if (!a) return;
    trackRecentAsset(a);
    if (window.DamMediaPreview && typeof window.DamMediaPreview.openAsset === "function") {
      window.DamMediaPreview.openAsset(a, { siblings: list, index: idx >= 0 ? idx : 0 });
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
    if (!opts.keepDiscovery) discoveryWhen = "";
    document.querySelectorAll(".dam-branding-tab").forEach(function (b) {
      var on = b.getAttribute("data-tab") === tab;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
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
    ["damBrandingSearch", "damBrandingGraphicsOnly"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var handler = function () {
        renderActiveSection();
      };
      el.addEventListener("input", handler);
      el.addEventListener("change", handler);
    });
    var arch = document.getElementById("damBrandingIncludeArchive");
    if (arch) {
      arch.addEventListener("change", function () {
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

  async function boot() {
    try {
      await loadIndex();
      await loadSearchIndex();
      await loadAssociations();
      await loadTokens();
      renderTagFilters();
      bindTabs();
      bindFilters();
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
      if (qs) {
        var search = document.getElementById("damBrandingSearch");
        if (search) search.value = qs;
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
